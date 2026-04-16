#!/usr/bin/env bash
# sync-opensource.sh — Filters proprietary code and pushes to the public repo.
#
# Called by .github/workflows/sync-opensource.yml on push to main.
# Can also be run locally for testing:
#   OPENSOURCE_REPO=git@github.com:Inkflow/inkflow.git DRY_RUN=1 bash scripts/sync-opensource.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EXCLUDE_FILE="$REPO_ROOT/.opensource-exclude"
WORK_DIR=$(mktemp -d)
DRY_RUN="${DRY_RUN:-0}"

# Require OPENSOURCE_REPO env var
if [[ -z "${OPENSOURCE_REPO:-}" ]]; then
  echo "ERROR: OPENSOURCE_REPO environment variable is required"
  echo "  e.g. OPENSOURCE_REPO=git@github.com:Inkflow/inkflow.git"
  exit 1
fi

echo "=== Inkflow Open Source Sync ==="
echo "Source:      $REPO_ROOT"
echo "Target:      $OPENSOURCE_REPO"
echo "Exclude:     $EXCLUDE_FILE"
echo "Work dir:    $WORK_DIR"
echo "Dry run:     $DRY_RUN"
echo ""

# Build rsync exclude args from .opensource-exclude
RSYNC_EXCLUDES=()
while IFS= read -r line; do
  # Skip empty lines and comments
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  # Trim whitespace
  line=$(echo "$line" | xargs)
  RSYNC_EXCLUDES+=(--exclude="$line")
done < "$EXCLUDE_FILE"

# Always exclude git internals and build artifacts
RSYNC_EXCLUDES+=(--exclude=".git/")
RSYNC_EXCLUDES+=(--exclude="node_modules/")
RSYNC_EXCLUDES+=(--exclude=".next/")
RSYNC_EXCLUDES+=(--exclude="out/")
RSYNC_EXCLUDES+=(--exclude=".vite/")
RSYNC_EXCLUDES+=(--exclude="coverage/")

# Clone public repo (or init if empty)
echo "--- Cloning public repo ---"
if ! git clone --depth 1 "$OPENSOURCE_REPO" "$WORK_DIR/public" 2>/dev/null; then
  echo "Public repo is empty or doesn't exist yet. Initializing..."
  mkdir -p "$WORK_DIR/public"
  cd "$WORK_DIR/public"
  git init
  git remote add origin "$OPENSOURCE_REPO"
  cd "$REPO_ROOT"
fi

# Sync files with rsync (delete files in target that don't exist in source)
echo "--- Syncing files (excluding proprietary paths) ---"
rsync -av --delete \
  "${RSYNC_EXCLUDES[@]}" \
  "$REPO_ROOT/" \
  "$WORK_DIR/public/"

# Show what changed
cd "$WORK_DIR/public"
echo ""
echo "--- Changes detected ---"
git add -A

# Use git status --porcelain (works in repos with no prior commits)
STAGED=$(git status --porcelain)
if [[ -z "$STAGED" ]]; then
  echo "No changes to sync."
  rm -rf "$WORK_DIR"
  exit 0
fi

FILECOUNT=$(echo "$STAGED" | wc -l)
echo "$STAGED" | head -30 || true
echo "  $FILECOUNT files changed"

# Get the latest commit message from private repo for context
LATEST_MSG=$(cd "$REPO_ROOT" && git log -1 --pretty=format:"%s")

# Commit and push
git config user.name "Inkflow Bot"
git config user.email "bot@inkflow.app"
git commit -m "sync: $LATEST_MSG" -m "Automated sync from private repository."

if [[ "$DRY_RUN" == "1" ]]; then
  echo ""
  echo "=== DRY RUN — would push the following ==="
  git log -1 --stat
  echo ""
  echo "Skipping push (DRY_RUN=1)"
else
  echo "--- Pushing to public repo ---"
  git push origin HEAD:main
  echo ""
  echo "=== Sync complete ==="
fi

# Cleanup
rm -rf "$WORK_DIR"
