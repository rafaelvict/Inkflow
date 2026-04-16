import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { app } from "electron";
import type { NoteMeta, NoteSearchResult } from "../shared/types";
import { getStoredWorkspacePath, DEFAULT_WORKSPACE } from "./store";

// Default: Documents/Inkflow/Notes (used as fallback before store is ready)
const WORKSPACE_DIR_FALLBACK = DEFAULT_WORKSPACE;

/** Returns the current workspace path from store (async on first call). */
export function getWorkspacePath(): string {
  // Synchronous accessor for callers that need a path immediately.
  // The store is async — in practice, ensureWorkspace() must be called first
  // to warm up the cache. Returns fallback until store is loaded.
  return _cachedWorkspacePath ?? WORKSPACE_DIR_FALLBACK;
}

let _cachedWorkspacePath: string | null = null;

/** Must be called once at startup (and after workspace change) to warm up the path cache. */
export async function refreshWorkspacePath(): Promise<string> {
  _cachedWorkspacePath = await getStoredWorkspacePath();
  return _cachedWorkspacePath;
}

// Inline nanoid-like ID generator (avoids importing nanoid in main process)
function generateId(size = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(size);
  let id = "";
  for (let i = 0; i < size; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

// One-time migration: move notes from old EscalIA folder to Inkflow
const LEGACY_WORKSPACE = path.join(app.getPath("documents"), "EscalIA", "Notes");

async function migrateFromLegacy(targetDir: string): Promise<void> {
  try {
    const legacyStat = await fs.stat(LEGACY_WORKSPACE);
    if (!legacyStat.isDirectory()) return;

    const entries = await fs.readdir(LEGACY_WORKSPACE, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const src = path.join(LEGACY_WORKSPACE, entry.name);
      const dest = path.join(targetDir, entry.name);
      try {
        await fs.access(dest);
        // Already exists in new location, skip
      } catch {
        await fs.cp(src, dest, { recursive: true });
      }
    }
    // Rename old folder so migration doesn't run again
    await fs.rename(LEGACY_WORKSPACE, LEGACY_WORKSPACE + ".migrated");
  } catch {
    // Legacy folder doesn't exist or migration failed — skip silently
  }
}

export async function ensureWorkspace(): Promise<string> {
  const wsPath = getWorkspacePath();
  await fs.mkdir(wsPath, { recursive: true });
  await migrateFromLegacy(wsPath);
  return wsPath;
}

export async function createNote(): Promise<{ id: string; dir: string }> {
  const id = generateId(12);
  const noteDir = path.join(getWorkspacePath(), id);
  await fs.mkdir(noteDir, { recursive: true });
  await fs.mkdir(path.join(noteDir, "assets"), { recursive: true });

  const now = new Date().toISOString();
  const meta: NoteMeta = {
    id,
    version: 1,
    title: "Sem título",
    createdAt: now,
    updatedAt: now,
    tags: [],
    pinned: false,
  };

  const emptyScene = {
    type: "excalidraw",
    version: 2,
    source: "Inkflow",
    elements: [],
    appState: { viewBackgroundColor: "#ffffff" },
    files: {},
  };

  await Promise.all([
    fs.writeFile(
      path.join(noteDir, "meta.json"),
      JSON.stringify(meta, null, 2),
    ),
    fs.writeFile(path.join(noteDir, "content.md"), ""),
    fs.writeFile(
      path.join(noteDir, "scene.excalidraw"),
      JSON.stringify(emptyScene, null, 2),
    ),
  ]);

  return { id, dir: noteDir };
}

export async function loadNote(id: string) {
  const noteDir = path.join(getWorkspacePath(), id);
  const [metaRaw, text, sceneRaw] = await Promise.all([
    fs.readFile(path.join(noteDir, "meta.json"), "utf-8"),
    fs.readFile(path.join(noteDir, "content.md"), "utf-8"),
    fs.readFile(path.join(noteDir, "scene.excalidraw"), "utf-8"),
  ]);
  return {
    meta: JSON.parse(metaRaw) as NoteMeta,
    text,
    scene: JSON.parse(sceneRaw),
  };
}

export async function saveNote(
  id: string,
  data: { text?: string; scene?: string; title?: string },
) {
  const noteDir = path.join(getWorkspacePath(), id);
  const writes: Promise<void>[] = [];

  if (data.text !== undefined) {
    writes.push(fs.writeFile(path.join(noteDir, "content.md"), data.text));
  }
  if (data.scene !== undefined) {
    writes.push(
      fs.writeFile(path.join(noteDir, "scene.excalidraw"), data.scene),
    );
  }

  // Always update updatedAt in meta
  const metaPath = path.join(noteDir, "meta.json");
  const meta: NoteMeta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
  meta.updatedAt = new Date().toISOString();
  if (data.title) meta.title = data.title;
  writes.push(fs.writeFile(metaPath, JSON.stringify(meta, null, 2)));

  await Promise.all(writes);
}

export async function listNotesRecent(): Promise<NoteMeta[]> {
  await ensureWorkspace();
  const entries = await fs.readdir(getWorkspacePath(), { withFileTypes: true });
  const metas: NoteMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const metaPath = path.join(getWorkspacePath(), entry.name, "meta.json");
      const raw = await fs.readFile(metaPath, "utf-8");
      metas.push(JSON.parse(raw));
    } catch {
      // Corrupted note directory, skip
    }
  }

  // Pinned first, then most recent
  return metas.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  });
}

export async function deleteNote(id: string): Promise<void> {
  const noteDir = path.join(getWorkspacePath(), id);
  await fs.rm(noteDir, { recursive: true, force: true });
}

export async function togglePinNote(id: string): Promise<boolean> {
  const metaPath = path.join(getWorkspacePath(), id, "meta.json");
  const meta: NoteMeta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
  meta.pinned = !meta.pinned;
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
  return meta.pinned;
}

export async function saveTags(id: string, tags: string[]): Promise<void> {
  const metaPath = path.join(getWorkspacePath(), id, "meta.json");
  const meta: NoteMeta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
  meta.tags = tags;
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
}

export async function getAllTags(): Promise<string[]> {
  const metas = await listNotesRecent();
  const tagSet = new Set<string>();
  for (const meta of metas) {
    for (const tag of meta.tags) {
      tagSet.add(tag);
    }
  }
  return [...tagSet].sort();
}

export async function searchNotes(query: string): Promise<NoteSearchResult[]> {
  await ensureWorkspace();
  const entries = await fs.readdir(getWorkspacePath(), { withFileTypes: true });
  const results: NoteSearchResult[] = [];
  const q = query.toLowerCase();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const noteDir = path.join(getWorkspacePath(), entry.name);
      const [metaRaw, text] = await Promise.all([
        fs.readFile(path.join(noteDir, "meta.json"), "utf-8"),
        fs.readFile(path.join(noteDir, "content.md"), "utf-8"),
      ]);
      const meta: NoteMeta = JSON.parse(metaRaw);

      const titleMatch = meta.title.toLowerCase().includes(q);
      const textLower = text.toLowerCase();
      const textIdx = textLower.indexOf(q);
      const tagMatch = meta.tags.some((t) => t.toLowerCase().includes(q));

      if (!titleMatch && textIdx === -1 && !tagMatch) continue;

      // Build snippet around the match in text content
      let snippet = "";
      if (textIdx !== -1) {
        const start = Math.max(0, textIdx - 40);
        const end = Math.min(text.length, textIdx + query.length + 60);
        snippet =
          (start > 0 ? "..." : "") +
          text.slice(start, end).replace(/\n/g, " ") +
          (end < text.length ? "..." : "");
      } else if (titleMatch) {
        // Show beginning of text as snippet
        snippet = text.slice(0, 100).replace(/\n/g, " ");
        if (text.length > 100) snippet += "...";
      }

      results.push({
        id: meta.id,
        title: meta.title,
        snippet,
        tags: meta.tags,
        updatedAt: meta.updatedAt,
        pinned: meta.pinned,
      });
    } catch {
      // Skip corrupted notes
    }
  }

  // Sort: pinned first, then by relevance (title match first), then date
  return results.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    const aTitle = a.title.toLowerCase().includes(q) ? 0 : 1;
    const bTitle = b.title.toLowerCase().includes(q) ? 0 : 1;
    if (aTitle !== bTitle) return aTitle - bTitle;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
