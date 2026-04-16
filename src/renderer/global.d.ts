interface Window {
  EXCALIDRAW_ASSET_PATH: string | string[] | undefined;
  EXCALIDRAW_EXPORT_SOURCE: string;
  electronAPI: {
    workspace: {
      createNote: () => Promise<{ id: string }>;
      loadNote: (
        id: string,
      ) => Promise<{ meta: any; text: string; scene: any }>;
      saveNote: (
        id: string,
        data: { text?: string; scene?: string; title?: string },
      ) => Promise<void>;
      listRecent: () => Promise<any[]>;
      deleteNote: (id: string) => Promise<void>;
      togglePin: (id: string) => Promise<boolean>;
      saveTags: (id: string, tags: string[]) => Promise<void>;
      getAllTags: () => Promise<string[]>;
      search: (query: string) => Promise<any[]>;
    };
    fileOps: {
      importNoteZip: () => Promise<{ id: string } | null>;
      exportNoteZip: (id: string) => Promise<boolean>;
      exportFile: (
        data: Uint8Array | string,
        defaultName: string,
        filterName: string,
        filterExtensions: string[],
      ) => Promise<boolean>;
      importNoteFile: (filePath: string) => Promise<{ id: string } | null>;
    };
    lifecycle: {
      onCheckBeforeClose: (callback: () => void) => () => void;
      respondCanClose: (canClose: boolean) => void;
      notifySaved: () => void;
      onMenuAction: (callback: (action: string) => void) => () => void;
    };
    shell: {
      openExternal: (url: string) => Promise<boolean>;
    };
    /** Resolves a File object to its filesystem path (webUtils, safe under sandbox:true) */
    getPathForFile: (file: File) => string;
    /** Auto-update API */
    update: {
      onEvent: (callback: (event: AppUpdateEvent) => void) => () => void;
      install: () => Promise<void>;
      simulate: (event: string) => Promise<void>;
    };
    /** Workspace sync settings */
    workspace2: {
      getPath: () => Promise<{ path: string; default: string }>;
      setPath: (p: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
      resetPath: () => Promise<{ ok: boolean; path?: string }>;
      choosePath: () => Promise<{ canceled: boolean; path?: string }>;
      notifyOpenNotes: (ids: string[]) => Promise<void>;
      onChanged: (callback: (event: { event: string; noteId: string }) => void) => () => void;
      onNoteExternallyModified: (callback: (noteId: string) => void) => () => void;
    };
    templates: {
      list: () => Promise<{ id: string; name: string; description: string; icon: string }[]>;
      createNote: (templateId: string) => Promise<{ ok: boolean; id?: string; error?: string }>;
    };
    ai: {
      draw: (prompt: string) => Promise<{ ok: boolean; elements?: any[]; error?: string }>;
      getSettings: () => Promise<{ ollamaUrl: string; model: string }>;
      saveSettings: (settings: { ollamaUrl?: string; model?: string }) => Promise<{ ollamaUrl: string; model: string }>;
      testConnection: (ollamaUrl: string) => Promise<{ ok: boolean; models?: string[]; error?: string }>;
    };
  };
}

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_CLOUD_ENABLED?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_BILLING_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Asset imports
declare module "*.png" {
  const src: string;
  export default src;
}
declare module "*.svg" {
  const src: string;
  export default src;
}

// Auto-update event payload
interface AppUpdateEvent {
  type: "checking" | "available" | "not-available" | "progress" | "downloaded" | "error";
  version?: string;
  percent?: number;
  bytesPerSecond?: number;
  releaseNotes?: string;
  message?: string;
}
