/**
 * watcher.ts — Filesystem watcher for the Inkflow workspace.
 *
 * Uses chokidar to watch for new/removed note directories in the workspace
 * AND for external modifications to files inside open notes.
 *
 * Pushes two events to the renderer:
 *   WORKSPACE_CHANGED  — note directory added/removed (HomeScreen refresh)
 *   NOTE_EXTERNALLY_MODIFIED — content.md or scene.excalidraw changed by
 *                              an external process while the note is open
 */

import { BrowserWindow } from "electron";
import path from "node:path";
import { IPC } from "../shared/ipc-channels";
import { getWorkspacePath } from "./workspace";

// chokidar is ESM in v4 — use dynamic import
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _chokidar: any = null;
async function getChokidar() {
  if (_chokidar) return _chokidar;
  _chokidar = await import("chokidar");
  return _chokidar;
}

const log = (...args: unknown[]) => console.log("[watcher]", ...args);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let watcher: any = null;

// --- State shared with ipc-handlers ---

/** Note IDs currently open in the renderer. */
const openNoteIds = new Set<string>();

/** Timestamp of the most recent local save per note, to avoid false positives. */
const lastLocalSaveTime = new Map<string, number>();

/** Called by IPC handler when the renderer's open tabs change. */
export function setOpenNotes(ids: string[]): void {
  openNoteIds.clear();
  for (const id of ids) openNoteIds.add(id);
}

/** Called by IPC NOTE_SAVE handler right after a successful local save. */
export function recordLocalSave(id: string): void {
  lastLocalSaveTime.set(id, Date.now());
}

// Files inside a note directory that we care about
const WATCHED_FILES = new Set(["content.md", "scene.excalidraw"]);

// Grace period (ms) after a local save during which external changes are ignored.
// Covers the time for the OS to flush and chokidar to detect the write we just did.
// 5s covers auto-save debounce (2s) + filesystem flush + chokidar stabilityThreshold.
const LOCAL_SAVE_GRACE_MS = 5000;

/** Start watching the current workspace directory. */
export async function startWatcher(win: BrowserWindow): Promise<void> {
  await stopWatcher();

  const workspacePath = getWorkspacePath();
  const chokidar = await getChokidar();

  log("watching:", workspacePath);

  // depth:1 — watch the workspace dir (depth 0) AND files inside note dirs (depth 1)
  watcher = chokidar.watch(workspacePath, {
    depth: 1,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });

  // Note directory added/removed → HomeScreen refresh
  const notifyDir = (event: string, filePath: string) => {
    const name = path.basename(filePath);
    if (path.extname(name) !== "") return; // skip files at depth 0
    log(`${event}: ${name}`);
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.WORKSPACE_CHANGED, { event, noteId: name });
    }
  };

  // File changed inside a note directory → possible external edit
  const notifyFileChange = (filePath: string) => {
    const fileName = path.basename(filePath);
    if (!WATCHED_FILES.has(fileName)) return;

    // Derive note ID from the parent directory name
    const noteId = path.basename(path.dirname(filePath));
    if (!noteId) return;

    // Only alert if the note is currently open in the renderer
    if (!openNoteIds.has(noteId)) return;

    // Suppress if this change arrived within the grace period after a local save
    const lastSave = lastLocalSaveTime.get(noteId) ?? 0;
    if (Date.now() - lastSave < LOCAL_SAVE_GRACE_MS) {
      return; // silently ignore own saves
    }

    log(`external change detected in note ${noteId} (${fileName})`);
    if (!win.isDestroyed()) {
      win.webContents.send(IPC.NOTE_EXTERNALLY_MODIFIED, noteId);
    }
  };

  watcher.on("addDir", (p: string) => notifyDir("add", p));
  watcher.on("unlinkDir", (p: string) => notifyDir("remove", p));
  watcher.on("change", (p: string) => notifyFileChange(p));
  watcher.on("error", (err: Error) => log("watcher error:", err.message));
}

/** Stop the active watcher (if any). */
export async function stopWatcher(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
    log("stopped");
  }
}

/** Restart the watcher (call after workspace path changes). */
export async function restartWatcher(win: BrowserWindow): Promise<void> {
  log("restarting...");
  await startWatcher(win);
}
