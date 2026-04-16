import { ipcMain, dialog, BrowserWindow, shell } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { IPC } from "../shared/ipc-channels";
import {
  createNote,
  loadNote,
  saveNote,
  listNotesRecent,
  deleteNote,
  togglePinNote,
  saveTags,
  getAllTags,
  searchNotes,
  getWorkspacePath,
  refreshWorkspacePath,
  ensureWorkspace,
} from "./workspace";
import {
  getStoredWorkspacePath,
  setStoredWorkspacePath,
  resetWorkspacePath,
  getAiSettings,
  setAiSettings,
  DEFAULT_WORKSPACE,
} from "./store";
import { restartWatcher, setOpenNotes, recordLocalSave } from "./watcher";
import {
  aiDraw,
  AI_SETTINGS_DEFAULTS,
  type AiSettings,
} from "./ai-service";
import { getTemplateList, getTemplateById } from "./templates";

// Lazy-load JSZip (heavy module)
let _JSZip: any = null;
async function getJSZip() {
  if (!_JSZip) {
    const mod = await import("jszip");
    _JSZip = mod.default ?? mod;
  }
  return _JSZip;
}

// --- Import safety limits ---
const IMPORT_MAX_FILES = 5_000;
const IMPORT_MAX_BYTES = 200 * 1024 * 1024; // 200 MB uncompressed

// Whitelist: only these paths are allowed inside a .note ZIP
const ALLOWED_PATHS_RE =
  /^(meta\.json|content\.md|scene\.excalidraw|assets\/[^/]+)$/;

export function registerIpcHandlers() {
  // --- Workspace CRUD ---

  ipcMain.handle(IPC.NOTE_CREATE, async () => {
    const { id } = await createNote();
    return { id };
  });

  ipcMain.handle(IPC.NOTE_LOAD, async (_event, id: string) => {
    return loadNote(id);
  });

  ipcMain.handle(
    IPC.NOTE_SAVE,
    async (
      _event,
      id: string,
      data: { text?: string; scene?: string; title?: string },
    ) => {
      await saveNote(id, data);
      // Record the save time so the watcher can suppress the self-triggered change event
      recordLocalSave(id);
    },
  );

  ipcMain.handle(IPC.NOTE_LIST_RECENT, async () => {
    return listNotesRecent();
  });

  ipcMain.handle(IPC.NOTE_DELETE, async (_event, id: string) => {
    await deleteNote(id);
  });

  ipcMain.handle(IPC.NOTE_PIN_TOGGLE, async (_event, id: string) => {
    return togglePinNote(id);
  });

  ipcMain.handle(
    IPC.NOTE_SAVE_TAGS,
    async (_event, id: string, tags: string[]) => {
      await saveTags(id, tags);
    },
  );

  ipcMain.handle(IPC.NOTE_ALL_TAGS, async () => {
    return getAllTags();
  });

  // Renderer notifies main of currently open note IDs (for conflict detection)
  ipcMain.handle(IPC.NOTE_OPEN, async (_event, ids: string[]) => {
    setOpenNotes(Array.isArray(ids) ? ids : []);
  });

  ipcMain.handle(IPC.NOTE_SEARCH, async (_event, query: string) => {
    return searchNotes(query);
  });

  // --- Export .note ZIP (all I/O in main) ---

  ipcMain.handle(IPC.EXPORT_NOTE_ZIP, async (event, id: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const noteDir = path.join(getWorkspacePath(), id);

    try {
      await fs.access(noteDir);
    } catch {
      return false;
    }

    let title = "nota";
    try {
      const meta = JSON.parse(
        await fs.readFile(path.join(noteDir, "meta.json"), "utf-8"),
      );
      title = meta.title || "nota";
    } catch {
      /* ignore */
    }

    const { canceled, filePath } = await dialog.showSaveDialog(win!, {
      defaultPath: `${sanitizeFilename(title)}.note`,
      filters: [{ name: "Inkflow Note", extensions: ["note"] }],
    });
    if (canceled || !filePath) return false;

    const Zip = await getJSZip();
    const zip = new Zip();
    await addDirToZip(zip, noteDir, "");

    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    await fs.writeFile(filePath, buffer);
    return true;
  });

  // --- Import .note ZIP (hardened) ---

  ipcMain.handle(IPC.IMPORT_NOTE_ZIP, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);

    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      filters: [{ name: "Inkflow Note", extensions: ["note"] }],
      properties: ["openFile"],
    });
    if (canceled || !filePaths[0]) return null;

    const Zip = await getJSZip();
    const data = await fs.readFile(filePaths[0]);
    const zip = await Zip.loadAsync(data);

    // --- Validate structure ---
    if (!zip.file("meta.json")) {
      dialog.showErrorBox(
        "Arquivo inválido",
        "O arquivo .note não contém meta.json.",
      );
      return null;
    }

    // --- Pre-scan: enforce limits and whitelist BEFORE extracting ---
    const entries = Object.entries(zip.files) as [string, any][];
    let fileCount = 0;
    let totalBytes = 0;

    for (const [relativePath, zipEntry] of entries) {
      if (zipEntry.dir) continue;

      fileCount++;
      if (fileCount > IMPORT_MAX_FILES) {
        dialog.showErrorBox(
          "Arquivo muito grande",
          `O arquivo .note contém mais de ${IMPORT_MAX_FILES} arquivos.`,
        );
        return null;
      }

      // Whitelist check: only known paths allowed
      if (!ALLOWED_PATHS_RE.test(relativePath)) {
        dialog.showErrorBox(
          "Arquivo suspeito",
          `Caminho não permitido no .note: "${relativePath}".\n` +
            "Apenas meta.json, content.md, scene.excalidraw e assets/* são aceitos.",
        );
        return null;
      }

      // Accumulate uncompressed size
      totalBytes += zipEntry._data?.uncompressedSize ?? 0;
      if (totalBytes > IMPORT_MAX_BYTES) {
        dialog.showErrorBox(
          "Arquivo muito grande",
          `O conteúdo descomprimido excede ${IMPORT_MAX_BYTES / 1024 / 1024} MB.`,
        );
        return null;
      }
    }

    // --- Extract to new note directory ---
    const { id, dir } = await createNote();
    // Canonical prefix with trailing separator for safe startsWith check
    const dirPrefix = path.resolve(dir) + path.sep;

    for (const [relativePath, zipEntry] of entries) {
      if (zipEntry.dir) continue;

      const resolved = path.resolve(dir, relativePath);
      // Path traversal guard: resolved path MUST start with dirPrefix
      if (!resolved.startsWith(dirPrefix)) {
        continue; // silently skip malicious paths
      }

      const content = await zipEntry.async("nodebuffer");
      await fs.mkdir(path.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content);
    }

    // Update meta with new id (keep original title/dates)
    try {
      const metaPath = path.join(dir, "meta.json");
      const meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
      meta.id = id;
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    } catch {
      /* meta may be malformed but we validated it exists */
    }

    return { id };
  });

  // --- Import .note file from a specific path (double-click association) ---

  ipcMain.handle(IPC.IMPORT_NOTE_FILE, async (_event, filePath: string) => {
    if (!filePath || !filePath.endsWith(".note")) return null;

    try {
      const Zip = await getJSZip();
      const data = await fs.readFile(filePath);
      const zip = await Zip.loadAsync(data);

      if (!zip.file("meta.json")) return null;

      // Quick validation and extract
      const { id, dir } = await createNote();
      const dirPrefix = path.resolve(dir) + path.sep;
      const entries = Object.entries(zip.files) as [string, any][];

      for (const [relativePath, zipEntry] of entries) {
        if (zipEntry.dir) continue;
        if (!ALLOWED_PATHS_RE.test(relativePath)) continue;

        const resolved = path.resolve(dir, relativePath);
        if (!resolved.startsWith(dirPrefix)) continue;

        const content = await zipEntry.async("nodebuffer");
        await fs.mkdir(path.dirname(resolved), { recursive: true });
        await fs.writeFile(resolved, content);
      }

      // Update meta with new id
      try {
        const metaPath = path.join(dir, "meta.json");
        const meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
        meta.id = id;
        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
      } catch { /* ok */ }

      return { id };
    } catch {
      return null;
    }
  });

  // --- Export generic file (PNG Uint8Array / SVG string / MD string) ---

  ipcMain.handle(
    IPC.EXPORT_FILE,
    async (
      event,
      data: Uint8Array | string,
      defaultName: string,
      filterName: string,
      filterExtensions: string[],
    ) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const { canceled, filePath } = await dialog.showSaveDialog(win!, {
        defaultPath: defaultName,
        filters: [{ name: filterName, extensions: filterExtensions }],
      });
      if (canceled || !filePath) return false;

      if (typeof data === "string") {
        await fs.writeFile(filePath, data, "utf-8");
      } else {
        await fs.writeFile(filePath, Buffer.from(data));
      }
      return true;
    },
  );

  // --- Open external URL (Ctrl+Click on links in editor) ---

  ipcMain.handle(IPC.SHELL_OPEN_EXTERNAL, async (_event, url: string) => {
    // Only allow http(s) URLs for safety
    if (/^https?:\/\//.test(url)) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  // --- Templates ---

  ipcMain.handle(IPC.TEMPLATE_LIST, async () => {
    return getTemplateList();
  });

  ipcMain.handle(IPC.TEMPLATE_CREATE_NOTE, async (_event, templateId: string) => {
    const template = getTemplateById(templateId);
    if (!template) return { ok: false, error: "Template not found" };

    const { id, dir } = await createNote();

    // Overwrite content and scene with template data
    await Promise.all([
      fs.writeFile(path.join(dir, "content.md"), template.content),
      fs.writeFile(path.join(dir, "scene.excalidraw"), JSON.stringify(template.scene, null, 2)),
    ]);

    // Update meta title
    const metaPath = path.join(dir, "meta.json");
    const meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));
    meta.title = template.name;
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

    return { ok: true, id };
  });

  ipcMain.handle(IPC.TEMPLATE_GET_SCENE, async (_event, templateId: string) => {
    const template = getTemplateById(templateId);
    if (!template || !template.scene) return null;
    return JSON.stringify(template.scene);
  });

  // --- AI: settings (persisted via electron-store) ---

  ipcMain.handle(IPC.AI_GET_SETTINGS, async () => {
    return getAiSettings();
  });

  ipcMain.handle(IPC.AI_SAVE_SETTINGS, async (_event, settings: Partial<AiSettings>) => {
    return setAiSettings(settings);
  });

  // --- AI: test Ollama connection ---

  ipcMain.handle(IPC.AI_TEST_CONNECTION, async (_event, ollamaUrl: string) => {
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const data = await res.json();
      const models = (data.models ?? []).map((m: any) => m.name as string);
      return { ok: true, models };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  });

  // --- AI: generate Excalidraw elements from text prompt ---

  ipcMain.handle(IPC.AI_DRAW, async (_event, prompt: string) => {
    try {
      const settings = await getAiSettings();
      const result = await aiDraw(prompt, settings);
      return { ok: true, elements: result.elements };
    } catch (e: any) {
      console.error("[ipc AI_DRAW]", e.message);
      return { ok: false, error: e.message };
    }
  });

  // --- Workspace / sync path ---
  ipcMain.handle(IPC.WORKSPACE_GET_PATH, async () => {
    return { path: getWorkspacePath(), default: DEFAULT_WORKSPACE };
  });

  ipcMain.handle(IPC.WORKSPACE_SET_PATH, async (_event, newPath: string) => {
    if (!newPath || typeof newPath !== "string") return { ok: false, error: "Invalid path" };
    try {
      await fs.mkdir(newPath, { recursive: true });
    } catch (e: any) {
      return { ok: false, error: `Cannot create directory: ${e.message}` };
    }
    await setStoredWorkspacePath(newPath);
    await refreshWorkspacePath();
    await ensureWorkspace();
    // Restart watcher on new path
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (win) await restartWatcher(win);
    return { ok: true, path: newPath };
  });

  ipcMain.handle(IPC.WORKSPACE_RESET_PATH, async () => {
    await resetWorkspacePath();
    await refreshWorkspacePath();
    await ensureWorkspace();
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (win) await restartWatcher(win);
    return { ok: true, path: getWorkspacePath() };
  });

  ipcMain.handle(IPC.WORKSPACE_CHOOSE_PATH, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getFocusedWindow();
    if (!win) return { canceled: true };
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: "Escolha a pasta de notas",
      properties: ["openDirectory", "createDirectory"],
    });
    if (canceled || !filePaths[0]) return { canceled: true };
    const chosen = filePaths[0];
    console.log("[workspace] user chose path:", chosen);
    return { canceled: false, path: chosen };
  });
}

// --- Helpers ---

async function addDirToZip(zip: any, dirPath: string, zipPath: string) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const entryZipPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await addDirToZip(zip, fullPath, entryZipPath);
    } else {
      zip.file(entryZipPath, await fs.readFile(fullPath));
    }
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 100);
}
