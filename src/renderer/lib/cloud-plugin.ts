/**
 * Cloud Plugin API — defines the extension point for Inkflow Cloud features.
 *
 * The open-source version of Inkflow works fully offline.
 * Cloud features (auth, sync, teams, billing, presence) are provided
 * by a separate closed-source plugin that registers itself here.
 *
 * In official releases, the plugin is bundled automatically.
 * When building from source, the app runs without cloud features.
 */

import type React from "react";

// Types defined here so the public repo has zero dependency on cloud modules.
// These mirror the types in cloud/lib/ but are standalone.

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

export interface CloudNote {
  id: string;
  title: string;
  content: string;
  scene: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  deleted: number;
}

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

// --- Plugin component prop types ---

export interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthUser;
  noteId: string;
  noteTitle: string;
  theme: "light" | "dark";
}

export interface PresenceAvatarsProps {
  noteId: string;
  uid: string;
  displayName: string;
}

export interface ConflictBannerProps {
  onReload: () => void;
  onDismiss: () => void;
}

export interface TeamDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthUser;
  theme: "light" | "dark";
  onOpenNote?: (id: string) => void;
}

export interface BillingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthUser;
  theme: "light" | "dark";
  noteCount: number;
}

export interface AuthScreenProps {
  theme: "light" | "dark";
}

// --- Sync engine interface ---

export interface SyncEngine {
  syncStatus: SyncStatus;
  lastSync: Date | null;
  queueSize: number;
  runSync: () => Promise<SyncResult | null>;
  pushWithFallback: (note: CloudNote) => Promise<void>;
}

// --- The plugin interface ---

export interface InkflowCloudPlugin {
  /** Display name for the plugin */
  name: string;

  // --- Auth ---
  AuthScreen: React.ComponentType<AuthScreenProps>;
  onAuthChange: (callback: (user: AuthUser | null) => void) => () => void;
  logout: () => Promise<void>;
  getCurrentUser: () => AuthUser | null;

  // --- Sync ---
  useSyncEngine: (opts: {
    authUser: AuthUser | null;
    getLocalNotes: () => Promise<CloudNote[]>;
    onPullNote: (note: CloudNote) => Promise<void>;
    onConflict: (local: CloudNote, remote: CloudNote) => Promise<"local" | "remote">;
  }) => SyncEngine;

  // --- Collaboration UI ---
  ShareDialog: React.ComponentType<ShareDialogProps>;
  PresenceAvatars: React.ComponentType<PresenceAvatarsProps>;
  ConflictBanner: React.ComponentType<ConflictBannerProps>;

  // --- Teams ---
  TeamDashboard: React.ComponentType<TeamDashboardProps>;

  // --- Billing ---
  BillingDialog: React.ComponentType<BillingDialogProps>;

  // --- Analytics (optional) ---
  trackEvent?: (event: string, uid?: string) => void;
  trackSession?: (uid: string) => void;
  logActivity?: (noteId: string, entry: any) => void;
}

// --- Plugin registry ---

let _plugin: InkflowCloudPlugin | null = null;

/**
 * Register the cloud plugin. Called once at app startup by the plugin module.
 */
export function registerCloudPlugin(plugin: InkflowCloudPlugin): void {
  if (_plugin) {
    console.warn("[cloud-plugin] Plugin already registered, replacing.");
  }
  _plugin = plugin;
  console.info(`[cloud-plugin] Registered: ${plugin.name}`);
}

/**
 * Get the registered cloud plugin, or null if running in community mode.
 */
export function getCloudPlugin(): InkflowCloudPlugin | null {
  return _plugin;
}

/**
 * Check if cloud features are available.
 */
export function hasCloudPlugin(): boolean {
  return _plugin !== null;
}
