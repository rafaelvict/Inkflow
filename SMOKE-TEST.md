# Inkflow E2E Smoke Test Checklist

End-to-end smoke test covering the full purchase flow:
**checkout -> webhook -> Firestore write -> app feature unlock**

---

## Pre-requisites

- [ ] Stripe CLI installed and authenticated (`stripe login`)
- [ ] Stripe Dashboard in **test mode** (test keys configured in Vercel env vars)
- [ ] App Electron running locally with `VITE_CLOUD_ENABLED=true`
- [ ] Firebase project configured (real dev/staging project or emulators)
- [ ] Test account created in Firebase Auth (email/password)
- [ ] Billing API deployed to Vercel (`https://inkflow-api.vercel.app/api` or custom domain)

---

## Step 1: Verify env var

Open DevTools in the Electron app (View > Toggle Developer Tools) and run in the console:

```js
// Should print the billing API URL or undefined (falls back to https://inkflow-api.vercel.app/api)
console.log(import.meta.env.VITE_BILLING_API_URL);
```

- [ ] URL is correct (production URL or fallback is acceptable)

---

## Step 2: Verify gating (free user)

Log in with a test account that has **no active subscription**.

- [ ] Tab "Times" in HomeScreen redirects to BillingDialog (upgrade prompt)
- [ ] "Share" button does NOT appear in the toolbar
- [ ] Cloud sync is NOT active
- [ ] BillingDialog shows upgrade options (Pro plan, trial, pricing)

---

## Step 3: Start webhook forwarding

In a terminal, run:

```bash
stripe listen --forward-to https://inkflow-api.vercel.app/api/webhooks/stripe
```

> If testing against a local dev server, replace the URL accordingly:
> `stripe listen --forward-to http://localhost:3000/api/webhooks/stripe`

- [ ] Stripe CLI is listening and shows the webhook signing secret
- [ ] Note the webhook signing secret (`whsec_...`) -- ensure it matches the one configured in Vercel env vars

---

## Step 4: Checkout flow

1. In the app, click "Assinar Pro" (or "Subscribe to Pro") in the BillingDialog
2. A browser window should open with the Stripe Checkout page
3. Complete checkout using the test card below:

| Field | Value |
|-------|-------|
| Card number | `4242 4242 4242 4242` |
| Expiry | Any future date (e.g., `12/30`) |
| CVC | Any 3 digits (e.g., `123`) |
| Name | Any name |

- [ ] Checkout page opened in browser
- [ ] Payment completed successfully
- [ ] Redirected to success page

---

## Step 5: Verify webhook processing

Check the terminal running `stripe listen`:

- [ ] Event `checkout.session.completed` was received
- [ ] Webhook returned HTTP 200

If the webhook fails (non-200), check:
- Webhook signing secret matches between Stripe CLI and Vercel env var `STRIPE_WEBHOOK_SECRET`
- Billing API is deployed and accessible
- Firebase Admin SDK credentials are configured in Vercel

---

## Step 6: Verify Firestore write

Open the Firebase Console and navigate to Firestore:

**Path:** `users/{uid}/billing/subscription`

- [ ] Document exists
- [ ] `plan` field is `"pro"`
- [ ] `status` field is `"active"`
- [ ] `stripeCustomerId` field is populated (starts with `cus_`)
- [ ] `currentPeriodEnd` field is set (future date)

---

## Step 7: Verify feature unlock in app (< 30 seconds)

The app uses `onSnapshot` to listen for Firestore changes, so it should react automatically.

- [ ] Tab "Times" now works (opens TeamDashboard instead of BillingDialog)
- [ ] "Share" button appears in the toolbar
- [ ] BillingDialog shows active Pro plan
- [ ] Unlock happened within 30 seconds of checkout completion

---

## Step 8: Verify Customer Portal

1. Open BillingDialog
2. Click "Gerenciar assinatura" (or "Manage subscription")

- [ ] Stripe Customer Portal opens in browser
- [ ] Shows current subscription details
- [ ] Cancel/modify options are available

---

## Cleanup

After testing, clean up the test subscription:

1. Cancel the subscription via Stripe Customer Portal or Stripe Dashboard
2. Wait for the `customer.subscription.deleted` webhook event
3. Verify the app returns to free tier:
   - [ ] Tab "Times" redirects to BillingDialog again
   - [ ] "Share" button disappears from toolbar
   - [ ] BillingDialog shows upgrade prompt

---

## Success Criteria

All items below must pass for the smoke test to be considered successful:

- [ ] Gating works for free users (features locked)
- [ ] Checkout redirects to Stripe and completes successfully
- [ ] Webhook processes event and writes to Firestore
- [ ] App unlocks Pro features automatically in < 30 seconds
- [ ] Customer Portal opens and works correctly
- [ ] Cancellation restores gating (features locked again)

---

## Stripe Test Cards Reference

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 3220` | 3D Secure required |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0341` | Attach fails (after token created) |

Full list: https://docs.stripe.com/testing#cards

---

## Troubleshooting

**Checkout does not open:**
- Check DevTools console for errors
- Verify `VITE_BILLING_API_URL` is correct
- Verify the billing API is deployed and returns 200 on health check

**Webhook returns non-200:**
- Verify `STRIPE_WEBHOOK_SECRET` env var in Vercel matches the Stripe CLI output
- Check Vercel function logs for errors
- Ensure Firebase Admin SDK is properly configured

**Firestore document not created:**
- Check Vercel function logs for Firebase write errors
- Verify Firebase service account credentials in Vercel env vars
- Check Firestore security rules allow the server write

**App does not unlock features:**
- Check DevTools console for Firestore snapshot errors
- Verify the user UID matches between Firebase Auth and the Firestore document
- Check that `onSubscriptionChange` listener is active (cloud plugin loaded)
