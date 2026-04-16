/**
 * store.ts — Persistent app settings via electron-store (lazy-loaded ESM).
 *
 * electron-store v11 is ESM-only. We load it lazily via dynamic import()
 * so the Vite CJS bundle doesn't break at startup.
 */

import { app } from "electron";
import path from "node:path";

export const DEFAULT_WORKSPACE = path.join(
  app.getPath("documents"),
  "Inkflow",
  "Notes",
);

interface StoreSchema {
  workspacePath: string;
  aiOllamaUrl: string;
  aiModel: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _store: any = null;

async function getStore() {
  if (_store) return _store;
  const { default: Store } = await import("electron-store");

  _store = new Store({
    name: "inkflow-settings",
    defaults: {
      workspacePath: DEFAULT_WORKSPACE,
      aiOllamaUrl: "http://localhost:11434",
      aiModel: "qwen2.5:1.5b",
    },
  }) as any;

  // Migrate settings from legacy escalia-settings store (one-time)
  if (_store.size === 0 || !_store.get("_migrated")) {
    try {
      const legacyStore = new Store({ name: "escalia-settings" }) as any;
      if (legacyStore.size > 0) {
        const legacyWorkspace = legacyStore.get("workspacePath") as string | undefined;
        // Migrate workspace path, updating the old EscalIA default to new Inkflow default
        const oldDefault = path.join(app.getPath("documents"), "EscalIA", "Notes");
        if (legacyWorkspace && legacyWorkspace !== oldDefault) {
          // User had a custom workspace path — keep it
          _store.set("workspacePath", legacyWorkspace);
        }
        const ollamaUrl = legacyStore.get("aiOllamaUrl") as string | undefined;
        if (ollamaUrl) _store.set("aiOllamaUrl", ollamaUrl);
        const model = legacyStore.get("aiModel") as string | undefined;
        if (model) _store.set("aiModel", model);
      }
    } catch {
      // Legacy store doesn't exist — skip
    }
    _store.set("_migrated", true);
  }

  return _store;
}

export async function getStoredWorkspacePath(): Promise<string> {
  const store = await getStore();
  return (store.get("workspacePath") as string) || DEFAULT_WORKSPACE;
}

export async function setStoredWorkspacePath(p: string): Promise<void> {
  const store = await getStore();
  store.set("workspacePath", p);
}

export async function resetWorkspacePath(): Promise<void> {
  const store = await getStore();
  store.set("workspacePath", DEFAULT_WORKSPACE);
}

// --- AI Settings ---

export async function getAiSettings(): Promise<{ ollamaUrl: string; model: string }> {
  const store = await getStore();
  return {
    ollamaUrl: (store.get("aiOllamaUrl") as string) || "http://localhost:11434",
    model: (store.get("aiModel") as string) || "qwen2.5:1.5b",
  };
}

export async function setAiSettings(settings: { ollamaUrl?: string; model?: string }): Promise<{ ollamaUrl: string; model: string }> {
  const store = await getStore();
  if (settings.ollamaUrl !== undefined) store.set("aiOllamaUrl", settings.ollamaUrl);
  if (settings.model !== undefined) store.set("aiModel", settings.model);
  return getAiSettings();
}
