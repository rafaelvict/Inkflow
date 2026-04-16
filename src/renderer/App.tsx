import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { SplitPane } from "./components/SplitPane";
import { TextEditor } from "./components/TextEditor";
import { CanvasPane } from "./components/CanvasPane";
import { Toolbar } from "./components/Toolbar";
import { StatusBar } from "./components/StatusBar";
import { HomeScreen } from "./components/HomeScreen";
import { CommandPalette, type PaletteItem } from "./components/CommandPalette";
import { TabBar, type TabInfo } from "./components/TabBar";
import { FormatToolbar } from "./components/FormatToolbar";
import { DragOverlay } from "./components/DragOverlay";
import { UpdateBanner } from "./components/UpdateBanner";
import { WorkspaceSettings } from "./components/WorkspaceSettings";
import { AiPanel } from "./components/AiPanel";
import { AiSettingsDialog } from "./components/AiSettingsDialog";
import { TemplateGallery } from "./components/TemplateGallery";
import { DonateDialog } from "./components/DonateDialog";
import { AboutDialog, SUPPORT_URL } from "./components/AboutDialog";
import { getCloudPlugin, hasCloudPlugin, type AuthUser, type CloudNote } from "./lib/cloud-plugin";
import { useSubscription } from "./cloud/hooks/useSubscription";
import { useEditorPrefs } from "./hooks/useEditorPrefs";
import {
  applyFontSizeToSelection,
  hasTextSelection,
} from "./editor/text-style-extension";
import type { EditorView } from "@codemirror/view";

type ViewMode = "split" | "text-only" | "canvas-only";
type AppScreen = "home" | "editor";

/** In-memory state for a single open tab */
interface TabState {
  noteId: string;
  title: string;
  text: string;
  scene: any;
  dirty: boolean;
  cursorLine: number;
  cursorCol: number;
  excalidrawApi: any | null;
  editorView: EditorView | null;
  checklistChecked: number;
  checklistTotal: number;
}

export function App() {
  // --- Cloud plugin (null in open-source / community builds) ---
  const cloud = getCloudPlugin();

  const [screen, setScreen] = useState<AppScreen>("home");
  const [theme, setTheme] = useState<"light" | "dark">(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [templateGalleryOpen, setTemplateGalleryOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [teamDashboardOpen, setTeamDashboardOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(!cloud ? false : true);
  const [authSkipped, setAuthSkipped] = useState(() => !cloud ? true : localStorage.getItem("inkflow:authSkipped") === "true");
  const { prefs: editorPrefs, setPrefs: setEditorPrefs, increaseFontSize, decreaseFontSize } = useEditorPrefs();

  // --- Subscription gating (cloud plugin only) ---
  const { isPro, loading: subLoading } = useSubscription(cloud && authUser ? authUser.uid : null);
  const [upgradeFeature, setUpgradeFeature] = useState("");

  const requirePro = useCallback((featureName: string, action: () => void) => {
    if (isPro) { action(); return; }
    setUpgradeFeature(featureName);
    setBillingOpen(true);
  }, [isPro]);

  // --- Drag-and-drop state ---
  type DragState = "idle" | "drag-over" | "importing";
  const [dragState, setDragState] = useState<DragState>("idle");
  const [dragFileCount, setDragFileCount] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const dragCounterRef = useRef(0); // tracks nested dragenter/dragleave
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3500);
  }, []);

  // --- Multi-tab state ---
  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  // Lightweight counter that increments when any tab becomes dirty - drives auto-save
  const [dirtyTick, setDirtyTick] = useState(0);
  // Notes that were modified externally while open (show ConflictBanner)
  const [conflictNoteIds, setConflictNoteIds] = useState<Set<string>>(new Set());

  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const activeTab = tabs.find((t) => t.noteId === activeTabId) ?? null;

  // Stable ref for openNote — set after openNote is defined
  const openNoteRef = useRef<((id: string) => Promise<void>) | null>(null);

  // --- Helpers to update a specific tab ---
  const updateTab = useCallback(
    (noteId: string, patch: Partial<TabState>) => {
      setTabs((prev) =>
        prev.map((t) => (t.noteId === noteId ? { ...t, ...patch } : t)),
      );
    },
    [],
  );

  // Mark a tab dirty WITHOUT triggering full tabs re-render for auto-save
  const markDirty = useCallback((noteId: string) => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.noteId === noteId);
      if (tab && !tab.dirty) {
        setDirtyTick((n) => n + 1);
        return prev.map((t) =>
          t.noteId === noteId ? { ...t, dirty: true } : t,
        );
      }
      // Already dirty - don't create new array
      if (tab?.dirty) return prev;
      return prev;
    });
  }, []);

  // --- Detect system theme ---
  useEffect(() => {
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  // --- Dismiss splash screen ---
  useEffect(() => {
    const splash = document.getElementById("splash");
    if (splash) {
      splash.classList.add("fade-out");
      setTimeout(() => splash.remove(), 500);
    }
  }, []);

  // --- Auth state listener (cloud plugin only) ---
  useEffect(() => {
    if (!cloud) return;
    const unsub = cloud.onAuthChange((user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (user) {
        cloud.trackEvent?.("app_open", user.uid);
        cloud.trackSession?.(user.uid);
      }
    });
    return unsub;
  }, [cloud]);

  // --- Auth skip handler ---
  useEffect(() => {
    const handler = () => {
      setAuthSkipped(true);
      localStorage.setItem("inkflow:authSkipped", "true");
    };
    window.addEventListener("auth:skip", handler);
    return () => window.removeEventListener("auth:skip", handler);
  }, []);

  // --- Cloud sync engine (only when plugin is available) ---
  const syncOpts = {
    authUser,
    getLocalNotes: async () => {
      const list = await window.electronAPI.workspace.listRecent();
      return list.map((n: any) => ({
        id: n.id,
        title: n.title ?? "Sem titulo",
        content: n.content ?? "",
        scene: n.scene ?? "{}",
        tags: n.tags ?? [],
        pinned: n.pinned ?? false,
        createdAt: n.createdAt ?? new Date().toISOString(),
        updatedAt: n.updatedAt ?? new Date().toISOString(),
      }));
    },
    onPullNote: async (note: CloudNote) => {
      await window.electronAPI.workspace.saveNote(note.id, {
        text: note.content,
        scene: note.scene,
        title: note.title,
      });
    },
    onConflict: async (_local: CloudNote, _remote: CloudNote) => {
      return "remote" as const;
    },
  };
  const syncEngine = cloud?.useSyncEngine(syncOpts);
  const syncStatus = syncEngine?.syncStatus ?? "idle";
  const lastSync = syncEngine?.lastSync ?? null;
  const queueSize = syncEngine?.queueSize ?? 0;
  const runSync = syncEngine?.runSync ?? (async () => null);
  const pushWithFallback = syncEngine?.pushWithFallback ?? (async () => {});

  // --- Notify main of currently open note IDs (for external edit detection) ---
  useEffect(() => {
    const ids = tabs.map((t) => t.noteId);
    window.electronAPI.workspace2.notifyOpenNotes(ids).catch(() => {/* noop */});
  }, [tabs]);

  // --- Listen for external modifications and mark conflicted notes ---
  useEffect(() => {
    const unsub = window.electronAPI.workspace2.onNoteExternallyModified((noteId) => {
      setConflictNoteIds((prev) => {
        const next = new Set(prev);
        next.add(noteId);
        return next;
      });
    });
    return unsub;
  }, []);

  // --- Drag-and-drop: import .note files by dragging onto the window ---
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        const noteFiles = Array.from(e.dataTransfer?.items ?? []).filter(
          (item) => item.kind === "file"
        );
        const noteCount = noteFiles.length;
        setDragFileCount(noteCount);
        setDragState("drag-over");
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setDragState("idle");
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setDragState("importing");

      const files = Array.from(e.dataTransfer?.files ?? []);
      const noteFiles = files.filter((f) => f.name.endsWith(".note"));

      if (noteFiles.length === 0) {
        setDragState("idle");
        showToast("⚠️ Nenhum arquivo .note encontrado");
        return;
      }

      let imported = 0;
      let failed = 0;
      for (const file of noteFiles) {
        // In Electron with sandbox:true, use webUtils.getPathForFile (exposed via preload)
        const filePath = window.electronAPI.getPathForFile(file);
        if (!filePath) { failed++; continue; }        try {
          const result = await window.electronAPI.fileOps.importNoteFile(filePath);
          if (result?.id) {
            imported++;
            // If home screen is shown, it will refresh on next navigation;
            // if in editor, open the imported note in a new tab
            openNoteRef.current?.(result.id);
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      setDragState("idle");
      if (imported > 0 && failed === 0) {
        showToast(`✅ ${imported} ${imported === 1 ? "nota importada" : "notas importadas"}`);
      } else if (imported > 0) {
        showToast(`✅ ${imported} importadas, ⚠️ ${failed} com erro`);
      } else {
        showToast("❌ Falha ao importar — arquivo inválido");
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [showToast]);

  // --- Font size keyboard shortcuts (Ctrl+= increase, Ctrl+- decrease) ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        const view = tabsRef.current.find(
          (t) => t.noteId === activeTabIdRef.current,
        )?.editorView;
        if (view && hasTextSelection(view)) {
          // Apply to selected range only
          applyFontSizeToSelection(view, editorPrefs.fontSize + 2);
          view.focus();
        } else {
          increaseFontSize();
        }
      } else if (e.key === "-") {
        e.preventDefault();
        const view = tabsRef.current.find(
          (t) => t.noteId === activeTabIdRef.current,
        )?.editorView;
        if (view && hasTextSelection(view)) {
          applyFontSizeToSelection(view, Math.max(editorPrefs.fontSize - 2, 8));
          view.focus();
        } else {
          decreaseFontSize();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [increaseFontSize, decreaseFontSize, editorPrefs.fontSize]);

  // --- Open note (creates tab or focuses existing) ---
  const openNote = useCallback(
    async (id: string) => {
      if (tabsRef.current.some((t) => t.noteId === id)) {
        setActiveTabId(id);
        setScreen("editor");
        return;
      }

      const data = await window.electronAPI.workspace.loadNote(id);
      const newTab: TabState = {
        noteId: id,
        title: data.meta.title || "Sem título",
        text: data.text,
        scene: data.scene,
        dirty: false,
        cursorLine: 1,
        cursorCol: 1,
        excalidrawApi: null,
        editorView: null,
        checklistChecked: 0,
        checklistTotal: 0,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(id);
      setScreen("editor");
    },
    [],
  );
  // Keep ref in sync so drag handler can call openNote without stale closure
  openNoteRef.current = openNote;

  // --- Create note ---
  const createNote = useCallback(async () => {
    const { id } = await window.electronAPI.workspace.createNote();
    await openNote(id);
  }, [openNote]);

  // --- Save a specific tab ---
  const saveTab = useCallback(
    async (noteId: string) => {
      const tab = tabsRef.current.find((t) => t.noteId === noteId);
      if (!tab) return;

      const sceneJson = tab.excalidrawApi
        ? JSON.stringify({
            type: "excalidraw",
            version: 2,
            source: "Inkflow",
            elements: tab.excalidrawApi.getSceneElements(),
            appState: {
              viewBackgroundColor:
                tab.excalidrawApi.getAppState().viewBackgroundColor,
            },
            files: tab.excalidrawApi.getFiles(),
          })
        : undefined;

      const title =
        tab.text.split("\n")[0]?.slice(0, 60).trim() || "Sem título";

      await window.electronAPI.workspace.saveNote(noteId, {
        text: tab.text,
        scene: sceneJson,
        title,
      });

      setTabs((prev) =>
        prev.map((t) =>
          t.noteId === noteId ? { ...t, dirty: false, title } : t,
        ),
      );

      // Cloud sync: push note with offline fallback
      if (authUser) {
        try {
          const meta = (await window.electronAPI.workspace.loadNote(noteId)).meta;
          const cloudNote: CloudNote = {
            id: noteId,
            title,
            content: tab.text,
            scene: sceneJson ?? "{}",
            tags: meta.tags ?? [],
            pinned: meta.pinned ?? false,
            createdAt: meta.createdAt,
            updatedAt: new Date().toISOString(),
          };
          pushWithFallback(cloudNote).catch((e) =>
            console.error("[cloud-sync] push failed:", e),
          );
          // Log activity (cloud plugin only)
          cloud?.logActivity?.(noteId, {
            uid: authUser.uid,
            displayName: authUser.displayName ?? authUser.email ?? "",
            action: "edited",
            summary: `Editou "${title}"`,
            timestamp: new Date().toISOString(),
          });
        } catch {
          // Local-only save is fine
        }
      }
    },
    [authUser, pushWithFallback],
  );

  // --- Save active tab ---
  const saveActiveTab = useCallback(async () => {
    if (activeTabIdRef.current) {
      setSaveStatus("saving");
      await saveTab(activeTabIdRef.current);
      setSaveStatus("saved");
    }
  }, [saveTab]);

  // --- Auto-save: debounce 2s, driven by dirtyTick (not tabs array) ---
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dirtyTick === 0) return; // initial mount

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setSaveStatus("unsaved");

    autoSaveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      for (const tab of tabsRef.current) {
        if (tab.dirty) {
          await saveTab(tab.noteId);
        }
      }
      setSaveStatus("saved");
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [dirtyTick, saveTab]);

  // --- Close a tab ---
  const closeTab = useCallback(
    async (noteId: string) => {
      const tab = tabsRef.current.find((t) => t.noteId === noteId);
      if (!tab) return;

      if (tab.dirty) {
        const shouldDiscard = window.confirm(
          `"${tab.title}" tem alterações não salvas. Descartar?`,
        );
        if (!shouldDiscard) return;
      }

      setTabs((prev) => {
        const next = prev.filter((t) => t.noteId !== noteId);

        if (activeTabIdRef.current === noteId) {
          const closedIndex = prev.findIndex((t) => t.noteId === noteId);
          if (next.length > 0) {
            const newIndex = Math.min(closedIndex, next.length - 1);
            setActiveTabId(next[newIndex].noteId);
          } else {
            setActiveTabId(null);
            setScreen("home");
          }
        }

        return next;
      });
    },
    [],
  );

  // --- Reorder tabs ---
  const reorderTabs = useCallback(
    (fromIndex: number, toIndex: number) => {
      setTabs((prev) => {
        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    },
    [],
  );

  // --- Close guard ---
  useEffect(() => {
    const cleanup = window.electronAPI.lifecycle.onCheckBeforeClose(() => {
      const anyDirty = tabsRef.current.some((t) => t.dirty);
      window.electronAPI.lifecycle.respondCanClose(!anyDirty);
    });
    return cleanup;
  }, []);

  // --- Menu actions ---
  useEffect(() => {
    const cleanup = window.electronAPI.lifecycle.onMenuAction(
      async (action) => {
        const currentId = activeTabIdRef.current;
        const currentTab = currentId
          ? tabsRef.current.find((t) => t.noteId === currentId)
          : null;

        switch (action) {
          case "new-note":
            await createNote();
            break;
          case "open-note":
            setScreen("home");
            break;
          case "save-note":
            await saveActiveTab();
            break;
          case "save-note-and-ack":
            for (const tab of tabsRef.current) {
              if (tab.dirty) await saveTab(tab.noteId);
            }
            window.electronAPI.lifecycle.notifySaved();
            break;
          case "export-note-zip":
            if (currentId) {
              await saveActiveTab();
              await window.electronAPI.fileOps.exportNoteZip(currentId);
            }
            break;
          case "import-note-zip": {
            const result = await window.electronAPI.fileOps.importNoteZip();
            if (result) await openNote(result.id);
            break;
          }
          case "export-md":
            if (currentTab) {
              await window.electronAPI.fileOps.exportFile(
                currentTab.text,
                `${currentTab.title}.md`,
                "Markdown",
                ["md"],
              );
            }
            break;
          case "export-png":
            if (currentTab?.excalidrawApi) {
              try {
                const { exportToBlob } = await import(
                  "@excalidraw/excalidraw"
                );
                const blob = await exportToBlob({
                  elements: currentTab.excalidrawApi.getSceneElements(),
                  appState: currentTab.excalidrawApi.getAppState(),
                  files: currentTab.excalidrawApi.getFiles(),
                  mimeType: "image/png",
                });
                const buffer = new Uint8Array(await blob.arrayBuffer());
                await window.electronAPI.fileOps.exportFile(
                  buffer,
                  `${currentTab.title}.png`,
                  "PNG Image",
                  ["png"],
                );
              } catch (e) {
                console.error("Export PNG failed:", e);
              }
            }
            break;
          case "export-svg":
            if (currentTab?.excalidrawApi) {
              try {
                const { exportToSvg } = await import(
                  "@excalidraw/excalidraw"
                );
                const svg = await exportToSvg({
                  elements: currentTab.excalidrawApi.getSceneElements(),
                  appState: currentTab.excalidrawApi.getAppState(),
                  files: currentTab.excalidrawApi.getFiles(),
                });
                const svgString = svg.outerHTML;
                await window.electronAPI.fileOps.exportFile(
                  svgString,
                  `${currentTab.title}.svg`,
                  "SVG Image",
                  ["svg"],
                );
              } catch (e) {
                console.error("Export SVG failed:", e);
              }
            }
            break;
          case "mode-split":
            setViewMode("split");
            break;
          case "mode-text":
            setViewMode("text-only");
            break;
          case "mode-canvas":
            setViewMode("canvas-only");
            break;
          case "command-palette":
            setPaletteOpen(true);
            break;
          case "global-search":
            setScreen("home");
            break;
          case "about":
            setAboutOpen(true);
            break;
          case "workspace-settings":
            setWorkspaceSettingsOpen(true);
            break;
          case "ai-settings":
            setAiSettingsOpen(true);
            break;
          case "templates":
            setTemplateGalleryOpen(true);
            break;
          case "teams":
            setTeamDashboardOpen(true);
            break;
          case "billing":
            setBillingOpen(true);
            break;
          case "support":
            window.electronAPI.shell.openExternal(SUPPORT_URL);
            break;
          case "logout":
            if (cloud) {
              await cloud.logout();
              setAuthSkipped(false);
              localStorage.removeItem("inkflow:authSkipped");
            }
            break;
          case "close-tab":
            if (currentId) await closeTab(currentId);
            break;
          case "next-tab": {
            const allTabs = tabsRef.current;
            if (allTabs.length < 2) break;
            const idx = allTabs.findIndex((t) => t.noteId === currentId);
            const nextIdx = (idx + 1) % allTabs.length;
            setActiveTabId(allTabs[nextIdx].noteId);
            break;
          }
          case "prev-tab": {
            const allTabs = tabsRef.current;
            if (allTabs.length < 2) break;
            const idx = allTabs.findIndex((t) => t.noteId === currentId);
            const prevIdx = (idx - 1 + allTabs.length) % allTabs.length;
            setActiveTabId(allTabs[prevIdx].noteId);
            break;
          }
          default:
            if (action.startsWith("import-note-file:")) {
              const filePath = action.slice("import-note-file:".length);
              const result = await window.electronAPI.fileOps.importNoteFile(filePath);
              if (result) await openNote(result.id);
            }
            break;
        }
      },
    );
    return cleanup;
  }, [createNote, openNote, saveActiveTab, saveTab, closeTab]);

  // --- Update window title ---
  useEffect(() => {
    if (activeTab) {
      document.title = activeTab.dirty
        ? `• ${activeTab.title} - Inkflow`
        : `${activeTab.title} - Inkflow`;
    } else {
      document.title = "Inkflow";
    }
  }, [activeTab?.dirty, activeTab?.title]);

  // --- Command palette items ---
  const paletteItems: PaletteItem[] = [
    { id: "new", label: "Nova nota", shortcut: "Ctrl+N", action: createNote },
    { id: "template", label: "Novo de template", shortcut: "Ctrl+Shift+N", action: () => setTemplateGalleryOpen(true) },
    { id: "open", label: "Abrir recentes", shortcut: "Ctrl+O", action: () => setScreen("home") },
    { id: "save", label: "Salvar", shortcut: "Ctrl+S", action: saveActiveTab },
    { id: "close-tab", label: "Fechar aba", shortcut: "Ctrl+W", action: () => activeTabId && closeTab(activeTabId) },
    { id: "mode-split", label: "Modo Split", shortcut: "Ctrl+1", action: () => setViewMode("split") },
    { id: "mode-text", label: "Só Texto", shortcut: "Ctrl+2", action: () => setViewMode("text-only") },
    { id: "mode-canvas", label: "Só Canvas", shortcut: "Ctrl+3", action: () => setViewMode("canvas-only") },
    { id: "theme", label: `Tema ${theme === "light" ? "Escuro" : "Claro"}`, action: () => setTheme(theme === "light" ? "dark" : "light") },
  ];

  // --- Tab info for TabBar ---
  const tabInfos: TabInfo[] = tabs.map((t) => ({
    id: t.noteId,
    title: t.title,
    dirty: t.dirty,
  }));

  // --- Stable callbacks for CanvasPane (avoid re-render loops) ---
  const canvasOnChangeRef = useRef<() => void>(() => {});
  const canvasOnApiReadyRef = useRef<(api: any) => void>(() => {});

  useEffect(() => {
    const noteId = activeTabId;
    if (!noteId) return;
    canvasOnChangeRef.current = () => markDirty(noteId);
    canvasOnApiReadyRef.current = (api: any) => {
      updateTab(noteId, { excalidrawApi: api });
    };
  }, [activeTabId, markDirty, updateTab]);

  // --- Auth guard (cloud plugin only) ---
  if (cloud && authLoading) {
    return <div className={`app-root theme-${theme}`} />;
  }

  if (cloud && !authUser && !authSkipped) {
    return <cloud.AuthScreen theme={theme} />;
  }

  // --- Render ---
  if (screen === "home") {
    return (
      <div className={`app-root theme-${theme}`}>
        {tabs.length > 0 && (
          <TabBar
            tabs={tabInfos}
            activeTabId={activeTabId}
            onSelect={(id) => {
              setActiveTabId(id);
              setScreen("editor");
            }}
            onClose={closeTab}
            onNew={createNote}
            onReorder={reorderTabs}
          />
        )}
        <HomeScreen
          onOpenNote={openNote}
          onNewNote={createNote}
          onOpenTemplates={() => setTemplateGalleryOpen(true)}
          onOpenDonate={() => setDonateOpen(true)}
          onOpenTeams={() => requirePro("Times", () => setTeamDashboardOpen(true))}
          onOpenBilling={() => setBillingOpen(true)}
          isLoggedIn={!!authUser}
          authUser={authUser}
          isPro={isPro}
          theme={theme}
        />
        <CommandPalette
          items={paletteItems}
          isOpen={paletteOpen}
          onClose={() => setPaletteOpen(false)}
        />
        <AboutDialog
          isOpen={aboutOpen}
          onClose={() => setAboutOpen(false)}
          theme={theme}
        />
        <WorkspaceSettings
          isOpen={workspaceSettingsOpen}
          onClose={() => setWorkspaceSettingsOpen(false)}
          theme={theme}
        />
        <AiSettingsDialog
          isOpen={aiSettingsOpen}
          onClose={() => setAiSettingsOpen(false)}
          theme={theme}
        />
        <TemplateGallery
          isOpen={templateGalleryOpen}
          onClose={() => setTemplateGalleryOpen(false)}
          onNoteCreated={openNote}
          theme={theme}
        />
        <DonateDialog
          isOpen={donateOpen}
          onClose={() => setDonateOpen(false)}
          theme={theme}
        />
        {cloud && authUser && (
          <cloud.TeamDashboard
            isOpen={teamDashboardOpen}
            onClose={() => setTeamDashboardOpen(false)}
            authUser={authUser}
            theme={theme}
            onOpenNote={openNote}
          />
        )}
        {cloud && authUser && (
          <cloud.BillingDialog
            isOpen={billingOpen}
            onClose={() => setBillingOpen(false)}
            authUser={authUser}
            theme={theme}
            noteCount={tabs.length}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`app-root theme-${theme}`}>
      <TabBar
        tabs={tabInfos}
        activeTabId={activeTabId}
        onSelect={setActiveTabId}
        onClose={closeTab}
        onNew={createNote}
        onReorder={reorderTabs}
      >
        {cloud && authUser && activeTabId && (
          <cloud.PresenceAvatars
            noteId={activeTabId}
            uid={authUser.uid}
            displayName={authUser.displayName ?? authUser.email ?? ""}
          />
        )}
      </TabBar>
      <Toolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onNew={createNote}
        onSave={saveActiveTab}
        onHome={() => setScreen("home")}
        dirty={activeTab?.dirty ?? false}
        aiPanelOpen={aiPanelOpen}
        onToggleAiPanel={() => setAiPanelOpen((v) => !v)}
        onShare={() => requirePro("Compartilhar", () => setShareOpen(true))}
        onOpenTemplates={() => setTemplateGalleryOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => t === "light" ? "dark" : "light")}
        isLoggedIn={!!authUser}
        isPro={isPro}
      />
      {activeTab && viewMode !== "canvas-only" && (
        <FormatToolbar
          editorView={activeTab.editorView}
          editorPrefs={editorPrefs}
          onFontFamilyChange={(family) => setEditorPrefs({ fontFamily: family })}
          onFontSizeIncrease={increaseFontSize}
          onFontSizeDecrease={decreaseFontSize}
        />
      )}
      {cloud && activeTab && conflictNoteIds.has(activeTab.noteId) && (
        <cloud.ConflictBanner
          onReload={async () => {
            const id = activeTab.noteId;
            const data = await window.electronAPI.workspace.loadNote(id);
            updateTab(id, {
              text: data.text,
              scene: data.scene,
              title: data.meta.title || "Sem título",
              dirty: false,
            });
            setConflictNoteIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }}
          onDismiss={() => {
            const id = activeTab.noteId;
            setConflictNoteIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }}
        />
      )}
      {aiPanelOpen && (
        <AiPanel
          onOpenSettings={() => setAiSettingsOpen(true)}
          selectionText={
            activeTab?.editorView
              ? (() => {
                  const state = activeTab.editorView.state;
                  const sel = state.selection.main;
                  return sel.from !== sel.to ? state.sliceDoc(sel.from, sel.to) : "";
                })()
              : ""
          }
          onElementsReady={(elements) => {
            const tab = tabsRef.current.find((t) => t.noteId === activeTabIdRef.current);
            if (!tab?.excalidrawApi) {
              console.warn("[AiPanel] Canvas API not ready - switching to canvas mode");
              setViewMode("split");
              return;
            }
            // Merge new elements with existing ones (don't overwrite)
            const existing = tab.excalidrawApi.getSceneElements() ?? [];
            tab.excalidrawApi.updateScene({
              elements: [...existing, ...elements],
            });
            // Mark dirty so auto-save persists the updated canvas
            markDirty(tab.noteId);
          }}
        />
      )}
      {activeTab && (
        <SplitPane
          mode={viewMode}
          left={
            <TextEditor
              key={`text-${activeTab.noteId}`}
              initialText={activeTab.text}
              theme={theme}
              fontFamily={editorPrefs.fontFamily}
              fontSize={editorPrefs.fontSize}
              onChange={(newText) => {
                // Update text via ref-based approach to avoid full re-render
                const noteId = activeTab.noteId;
                setTabs((prev) =>
                  prev.map((t) =>
                    t.noteId === noteId ? { ...t, text: newText } : t,
                  ),
                );
                markDirty(noteId);
              }}
              onCursorChange={(line, col) => {
                updateTab(activeTab.noteId, {
                  cursorLine: line,
                  cursorCol: col,
                });
              }}
              onChecklistStats={(checked, total) => {
                updateTab(activeTab.noteId, {
                  checklistChecked: checked,
                  checklistTotal: total,
                });
              }}
              onViewReady={(view) => {
                updateTab(activeTab.noteId, { editorView: view });
              }}
            />
          }
          right={
            <CanvasPane
              key={`canvas-${activeTab.noteId}`}
              initialData={activeTab.scene}
              theme={theme}
              onChange={() => canvasOnChangeRef.current()}
              onApiReady={(api) => canvasOnApiReadyRef.current(api)}
            />
          }
        />
      )}
      <StatusBar
        line={activeTab?.cursorLine ?? 1}
        col={activeTab?.cursorCol ?? 1}
        dirty={activeTab?.dirty ?? false}
        viewMode={viewMode}
        checklistChecked={activeTab?.checklistChecked ?? 0}
        checklistTotal={activeTab?.checklistTotal ?? 0}
        saveStatus={saveStatus}
        syncStatus={syncStatus}
        syncQueueSize={queueSize}
      />
      <CommandPalette
        items={paletteItems}
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
      <AboutDialog
        isOpen={aboutOpen}
        onClose={() => setAboutOpen(false)}
        theme={theme}
      />
      <WorkspaceSettings
        isOpen={workspaceSettingsOpen}
        onClose={() => setWorkspaceSettingsOpen(false)}
        theme={theme}
      />
      <AiSettingsDialog
        isOpen={aiSettingsOpen}
        onClose={() => setAiSettingsOpen(false)}
        theme={theme}
      />
      <TemplateGallery
        isOpen={templateGalleryOpen}
        onClose={() => setTemplateGalleryOpen(false)}
        onNoteCreated={openNote}
        onImportToCanvas={activeTab?.excalidrawApi ? (sceneJson: string) => {
          try {
            const scene = JSON.parse(sceneJson);
            if (scene.elements && activeTab.excalidrawApi) {
              const existing = activeTab.excalidrawApi.getSceneElements();
              activeTab.excalidrawApi.updateScene({
                elements: [...existing, ...scene.elements],
              });
              if (activeTabId) markDirty(activeTabId);
            }
          } catch {
            console.error("[template-import] failed to parse scene");
          }
        } : undefined}
        theme={theme}
      />
      <DonateDialog
        isOpen={donateOpen}
        onClose={() => setDonateOpen(false)}
        theme={theme}
      />
      {cloud && authUser && (
        <cloud.TeamDashboard
          isOpen={teamDashboardOpen}
          onClose={() => setTeamDashboardOpen(false)}
          authUser={authUser}
          theme={theme}
        />
      )}
      {cloud && authUser && (
        <cloud.BillingDialog
          isOpen={billingOpen}
          onClose={() => setBillingOpen(false)}
          authUser={authUser}
          theme={theme}
          noteCount={tabs.length}
        />
      )}
      {cloud && authUser && activeTab && (
        <cloud.ShareDialog
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          authUser={authUser}
          noteId={activeTab.noteId}
          noteTitle={activeTab.title}
          theme={theme}
        />
      )}
      <DragOverlay state={dragState} fileCount={dragFileCount} />
      <UpdateBanner />
      {toastMsg && (
        <div className="app-toast" role="status" aria-live="polite">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
