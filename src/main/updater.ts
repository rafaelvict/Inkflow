/**
 * updater.ts — Auto-update via electron-updater + GitHub Releases
 *
 * Usage: call initUpdater(mainWindow) after window is created.
 *
 * For production, requires:
 *   1. forge.config.ts with GitHub publisher
 *   2. package.json "build.publish" pointing to the GitHub repo
 *   3. GH_TOKEN env var for publishing new releases
 *
 * For local dev/test, set APP_UPDATE_FEED env var to a local update server URL.
 * electron-updater will skip auto-update in dev mode unless forceDevUpdateConfig is set.
 */

import { BrowserWindow, ipcMain, app } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";
import { IPC } from "../shared/ipc-channels";

const log = (...args: unknown[]) =>
  console.log("[updater]", ...args);

export function initUpdater(win: BrowserWindow): void {
  // Don't auto-update in dev mode (electron-forge starts with __DEV__)
  if (!app.isPackaged) {
    log("skipping auto-update — app is not packaged");
    // In dev, allow simulated events via IPC for UI testing
    ipcMain.handle(IPC.APP_UPDATE_SIMULATE, (_e, event: string) => {
      simulateUpdateEvent(win, event);
    });
    return;
  }

  autoUpdater.logger = null; // use our own log function
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Override feed URL if env var is set (useful for testing without GitHub)
  if (process.env.APP_UPDATE_FEED) {
    autoUpdater.setFeedURL({ provider: "generic", url: process.env.APP_UPDATE_FEED });
    log("using custom feed:", process.env.APP_UPDATE_FEED);
  }

  autoUpdater.on("checking-for-update", () => {
    log("checking for update...");
    win.webContents.send(IPC.APP_UPDATE_EVENT, { type: "checking" });
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    log("update available:", info.version);
    win.webContents.send(IPC.APP_UPDATE_EVENT, {
      type: "available",
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on("update-not-available", () => {
    log("up to date");
    win.webContents.send(IPC.APP_UPDATE_EVENT, { type: "not-available" });
  });

  autoUpdater.on("download-progress", (progress) => {
    const pct = Math.round(progress.percent);
    log(`downloading: ${pct}%`);
    win.webContents.send(IPC.APP_UPDATE_EVENT, {
      type: "progress",
      percent: pct,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    log("update downloaded:", info.version);
    win.webContents.send(IPC.APP_UPDATE_EVENT, {
      type: "downloaded",
      version: info.version,
    });
  });

  autoUpdater.on("error", (err: Error) => {
    log("error:", err.message);
    win.webContents.send(IPC.APP_UPDATE_EVENT, {
      type: "error",
      message: err.message,
    });
  });

  // IPC: renderer requests install-and-restart
  ipcMain.handle(IPC.APP_UPDATE_INSTALL, () => {
    log("install requested — quitting and installing");
    autoUpdater.quitAndInstall(false, true);
  });

  // Check for updates 3s after startup to avoid blocking app init
  setTimeout(() => autoUpdater.checkForUpdates(), 3000);
}

// --- Dev-mode simulation for UI testing ---
function simulateUpdateEvent(win: BrowserWindow, event: string) {
  const events: Record<string, object> = {
    available: { type: "available", version: "0.6.0", releaseNotes: "Bug fixes and improvements." },
    progress: { type: "progress", percent: 72, bytesPerSecond: 512000 },
    downloaded: { type: "downloaded", version: "0.6.0" },
    error: { type: "error", message: "Simulated update error" },
    checking: { type: "checking" },
    "not-available": { type: "not-available" },
  };
  const payload = events[event];
  if (payload) {
    log("simulate:", event);
    win.webContents.send(IPC.APP_UPDATE_EVENT, payload);
  }
}
