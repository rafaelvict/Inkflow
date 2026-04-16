export interface NoteMeta {
  id: string;
  version: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  pinned: boolean;
}

export interface NoteSearchResult {
  id: string;
  title: string;
  snippet: string; // Text around the match
  tags: string[];
  updatedAt: string;
  pinned: boolean;
}

export interface NoteData {
  meta: NoteMeta;
  text: string;
  scene: ExcalidrawSceneData;
}

export interface ExcalidrawSceneData {
  type: "excalidraw";
  version: number;
  source: string;
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}
