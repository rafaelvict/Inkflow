import { contextBridge, ipcRenderer, webUtils } from "electron";
import { IPC } from "../shared/ipc-channels";

// --- Workspace operations ---
const workspace = {
  createNote: (): Promise<{ id: string }> =>
    ipcRenderer.invoke(IPC.NOTE_CREATE),

  loadNote: (
    id: string,
  ): Promise<{ meta: any; text: string; scene: any }> =>
    ipcRenderer.invoke(IPC.NOTE_LOAD, id),

  saveNote: (
    id: string,
    data: { text?: string; scene?: string; title?: string },
  ): Promise<void> => ipcRenderer.invoke(IPC.NOTE_SAVE, id, data),

  listRecent: (): Promise<any[]> =>
    ipcRenderer.invoke(IPC.NOTE_LIST_RECENT),

  deleteNote: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC.NOTE_DELETE, id),

  togglePin: (id: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.NOTE_PIN_TOGGLE, id),

  saveTags: (id: string, tags: string[]): Promise<void> =>
    ipcRenderer.invoke(IPC.NOTE_SAVE_TAGS, id, tags),

  getAllTags: (): Promise<string[]> =>
    ipcRenderer.invoke(IPC.NOTE_ALL_TAGS),

  search: (query: string): Promise<any[]> =>
    ipcRenderer.invoke(IPC.NOTE_SEARCH, query),
};

// --- File operations (all heavy I/O stays in main) ---
const fileOps = {
  importNoteZip: (): Promise<{ id: string } | null> =>
    ipcRenderer.invoke(IPC.IMPORT_NOTE_ZIP),

  exportNoteZip: (id: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.EXPORT_NOTE_ZIP, id),

  exportFile: (
    data: Uint8Array | string,
    defaultName: string,
    filterName: string,
    filterExtensions: string[],
  ): Promise<boolean> =>
    ipcRenderer.invoke(
      IPC.EXPORT_FILE,
      data,
      defaultName,
      filterName,
      filterExtensions,
    ),

  importNoteFile: (filePath: string): Promise<{ id: string } | null> =>
    ipcRenderer.invoke(IPC.IMPORT_NOTE_FILE, filePath),
};

// --- Lifecycle (close guard + menu actions) ---
const lifecycle = {
  // Main asks renderer if it can close (dirty state check)
  onCheckBeforeClose: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("app:check-before-close", handler);
    return () => {
      ipcRenderer.removeListener("app:check-before-close", handler);
    };
  },

  // Renderer responds with dirty state
  respondCanClose: (canClose: boolean) => {
    ipcRenderer.send("app:can-close-response", canClose);
  },

  // Renderer confirms save completed (main waits for this before closing)
  notifySaved: () => {
    ipcRenderer.send("app:saved");
  },

  // Main → renderer menu actions
  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_event: any, action: string) => callback(action);
    ipcRenderer.on("menu-action", handler);
    return () => {
      ipcRenderer.removeListener("menu-action", handler);
    };
  },
};

contextBridge.exposeInMainWorld("electronAPI", {
  workspace,
  fileOps,
  lifecycle,
  shell: {
    openExternal: (url: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.SHELL_OPEN_EXTERNAL, url),
  },
  // webUtils: exposes getPathForFile for safe drag-and-drop file path resolution
  // (sandbox:true blocks direct access to electron module in renderer)
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  // Auto-update
  update: {
    onEvent: (callback: (event: Record<string, unknown>) => void) => {
      const handler = (_e: any, event: Record<string, unknown>) => callback(event);
      ipcRenderer.on(IPC.APP_UPDATE_EVENT, handler);
      return () => ipcRenderer.removeListener(IPC.APP_UPDATE_EVENT, handler);
    },
    install: (): Promise<void> => ipcRenderer.invoke(IPC.APP_UPDATE_INSTALL),
    simulate: (event: string): Promise<void> =>
      ipcRenderer.invoke(IPC.APP_UPDATE_SIMULATE, event),
  },
  // Workspace sync settings
  workspace2: {
    getPath: (): Promise<{ path: string; default: string }> =>
      ipcRenderer.invoke(IPC.WORKSPACE_GET_PATH),
    setPath: (p: string): Promise<{ ok: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke(IPC.WORKSPACE_SET_PATH, p),
    resetPath: (): Promise<{ ok: boolean; path?: string }> =>
      ipcRenderer.invoke(IPC.WORKSPACE_RESET_PATH),
    choosePath: (): Promise<{ canceled: boolean; path?: string }> =>
      ipcRenderer.invoke(IPC.WORKSPACE_CHOOSE_PATH),
    notifyOpenNotes: (ids: string[]): Promise<void> =>
      ipcRenderer.invoke(IPC.NOTE_OPEN, ids),
    onChanged: (callback: (event: { event: string; noteId: string }) => void) => {
      const handler = (_e: any, evt: { event: string; noteId: string }) => callback(evt);
      ipcRenderer.on(IPC.WORKSPACE_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC.WORKSPACE_CHANGED, handler);
    },
    onNoteExternallyModified: (callback: (noteId: string) => void) => {
      const handler = (_e: any, noteId: string) => callback(noteId);
      ipcRenderer.on(IPC.NOTE_EXTERNALLY_MODIFIED, handler);
      return () => ipcRenderer.removeListener(IPC.NOTE_EXTERNALLY_MODIFIED, handler);
    },
  },
  templates: {
    list: (): Promise<{ id: string; name: string; description: string; icon: string }[]> =>
      ipcRenderer.invoke(IPC.TEMPLATE_LIST),
    createNote: (templateId: string): Promise<{ ok: boolean; id?: string; error?: string }> =>
      ipcRenderer.invoke(IPC.TEMPLATE_CREATE_NOTE, templateId),
    getScene: (templateId: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.TEMPLATE_GET_SCENE, templateId),
  },
  ai: {
    draw: (prompt: string): Promise<{ ok: boolean; elements?: any[]; error?: string }> =>
      ipcRenderer.invoke(IPC.AI_DRAW, prompt),
    getSettings: (): Promise<{ ollamaUrl: string; model: string }> =>
      ipcRenderer.invoke(IPC.AI_GET_SETTINGS),
    saveSettings: (settings: { ollamaUrl?: string; model?: string }): Promise<{ ollamaUrl: string; model: string }> =>
      ipcRenderer.invoke(IPC.AI_SAVE_SETTINGS, settings),
    testConnection: (ollamaUrl: string): Promise<{ ok: boolean; models?: string[]; error?: string }> =>
      ipcRenderer.invoke(IPC.AI_TEST_CONNECTION, ollamaUrl),
  },
});
