import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import type { AuthUser } from "../lib/cloud-plugin";
import { hasCloudPlugin } from "../lib/cloud-plugin";
import "../styles/home.css";

// Team type used locally — matches cloud/lib/teams.ts
interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

// Lazy-loaded TeamWorkspace from cloud plugin (only loaded when cloud is enabled)
// Wrapped in hasCloudPlugin() check so the import is never attempted in open-source builds
// @ts-ignore — cloud module excluded in open-source builds
const CloudTeamWorkspace = hasCloudPlugin()
  ? React.lazy(() =>
      import("../cloud/components/TeamWorkspace").then((m: any) => ({ default: m.TeamWorkspace }))
    )
  : () => null;

interface NoteMeta {
  id: string;
  title: string;
  updatedAt: string;
  pinned: boolean;
  tags: string[];
}

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  tags: string[];
  updatedAt: string;
  pinned: boolean;
}

interface HomeScreenProps {
  onOpenNote: (id: string) => void;
  onNewNote: () => void;
  onOpenTemplates: () => void;
  onOpenDonate: () => void;
  onOpenTeams?: () => void;
  onOpenBilling?: () => void;
  isLoggedIn?: boolean;
  isPro?: boolean;
  authUser?: AuthUser | null;
  theme: "light" | "dark";
}

type HomeTab = "pessoal" | "time";

interface ContextMenuState {
  noteId: string;
  x: number;
  y: number;
}

export function HomeScreen({ onOpenNote, onNewNote, onOpenTemplates, onOpenDonate, onOpenTeams, onOpenBilling, isLoggedIn, isPro, authUser, theme }: HomeScreenProps) {
  const [homeTab, setHomeTab] = useState<HomeTab>("pessoal");
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [editingTagsFor, setEditingTagsFor] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const loadNotes = useCallback(async () => {
    const list = await window.electronAPI.workspace.listRecent();
    setNotes(list);
    const tags = await window.electronAPI.workspace.getAllTags();
    setAllTags(tags);
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Load user teams when logged in (cloud plugin only)
  useEffect(() => {
    if (authUser && hasCloudPlugin()) {
      // getUserTeams is loaded dynamically from the cloud plugin
      // @ts-ignore — cloud module excluded in open-source builds
      import("../cloud/lib/teams").then(({ getUserTeams }: { getUserTeams: (uid: string) => Promise<Team[]> }) => {
        getUserTeams(authUser.uid).then(setUserTeams).catch(() => setUserTeams([]));
      }).catch(() => setUserTeams([]));
    }
  }, [authUser]);

  // Reload notes when watcher detects external changes (sync via shared folder)
  useEffect(() => {
    const unsub = window.electronAPI.workspace2.onChanged(() => {
      loadNotes();
    });
    return unsub;
  }, [loadNotes]);

  // Close context menu on click elsewhere
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [contextMenu]);

  // Full-text search with debounce
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!search.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      const results = await window.electronAPI.workspace.search(search.trim());
      setSearchResults(results);
      setIsSearching(false);
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  // Filter notes by active tag (local filter when not searching)
  const displayNotes = useMemo(() => {
    if (searchResults !== null) return searchResults;
    if (!activeTag) return notes;
    return notes.filter((n) => n.tags?.includes(activeTag));
  }, [notes, activeTag, searchResults]);

  const handleDelete = useCallback(
    async (id: string) => {
      const note = notes.find((n) => n.id === id);
      const title = note?.title || "Sem título";
      if (!window.confirm(`Deletar "${title}"? Essa ação não pode ser desfeita.`)) return;
      await window.electronAPI.workspace.deleteNote(id);
      await loadNotes();
    },
    [notes, loadNotes],
  );

  const handleTogglePin = useCallback(
    async (id: string) => {
      await window.electronAPI.workspace.togglePin(id);
      await loadNotes();
    },
    [loadNotes],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, noteId: string) => {
      e.preventDefault();
      setContextMenu({ noteId, x: e.clientX, y: e.clientY });
    },
    [],
  );

  // Tag editing
  const startEditingTags = useCallback((noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    setEditingTagsFor(noteId);
    setTagInput(note?.tags?.join(", ") ?? "");
    setContextMenu(null);
    setTimeout(() => tagInputRef.current?.focus(), 50);
  }, [notes]);

  const saveEditedTags = useCallback(async () => {
    if (!editingTagsFor) return;
    const tags = tagInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    await window.electronAPI.workspace.saveTags(editingTagsFor, tags);
    setEditingTagsFor(null);
    setTagInput("");
    await loadNotes();
  }, [editingTagsFor, tagInput, loadNotes]);

  // Keyboard shortcut: Ctrl+Shift+F focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className={`home theme-${theme}`}>
      <div className="home-header">
        <div className="home-header-top">
          <h1 className="home-title">Inkflow</h1>
          {isLoggedIn && hasCloudPlugin() && onOpenBilling && (
            <button className="home-header-btn" onClick={onOpenBilling}>⭐ Assinatura</button>
          )}
        </div>

        {/* Tabs: Pessoal / Times (only when cloud plugin is available) */}
        {isLoggedIn && hasCloudPlugin() && (
          <div className="home-main-tabs">
            <button
              className={`home-main-tab ${homeTab === "pessoal" ? "home-main-tab--active" : ""}`}
              onClick={() => { setHomeTab("pessoal"); setSelectedTeam(null); }}
            >
              Pessoal
            </button>
            <button
              className={`home-main-tab ${homeTab === "time" ? "home-main-tab--active" : ""}`}
              onClick={() => {
                if (!isPro) { onOpenBilling?.(); return; }
                setHomeTab("time");
              }}
            >
              👥 Times
            </button>
          </div>
        )}
      </div>

      {/* TIMES TAB */}
      {homeTab === "time" && authUser && (
        <div className="home-teams-container">
          {!selectedTeam && (
            <div className="home-teams-list">
              {userTeams.length === 0 && (
                <p className="home-teams-empty">
                  Nenhum time ainda. Crie um time pelo menu Times.
                </p>
              )}
              {userTeams.map((t) => (
                <button
                  key={t.id}
                  className="home-teams-card"
                  onClick={() => setSelectedTeam(t)}
                >
                  <span className="home-teams-card-icon">👥</span>
                  <span className="home-teams-card-name">{t.name}</span>
                  <span className="home-teams-card-arrow">→</span>
                </button>
              ))}
            </div>
          )}
          {selectedTeam && hasCloudPlugin() && (
            <React.Suspense fallback={<div>Carregando...</div>}>
              <CloudTeamWorkspace
                team={selectedTeam}
                authUser={authUser}
                theme={theme}
                onOpenNote={onOpenNote}
                onBack={() => setSelectedTeam(null)}
              />
            </React.Suspense>
          )}
        </div>
      )}

      {/* PESSOAL TAB */}
      {homeTab === "pessoal" && (
      <>
      <div className="home-actions">
        <button className="home-new-btn" onClick={onNewNote}>
          + Nova nota
        </button>
        <button className="home-template-btn" onClick={onOpenTemplates}>
          📑 Usar template
        </button>
      </div>

      {notes.length === 0 && (
        <div className="home-welcome">
          <div className="home-welcome-icon">✨</div>
          <h2 className="home-welcome-title">Bem-vindo ao Inkflow!</h2>
          <p className="home-welcome-text">
            Seu workspace de notas + diagramas + IA. Crie uma nota em branco
            ou comece com um template pronto.
          </p>
          <div className="home-welcome-actions">
            <button className="home-welcome-btn primary" onClick={onNewNote}>
              + Nota em branco
            </button>
            <button className="home-welcome-btn secondary" onClick={onOpenTemplates}>
              📑 Escolher template
            </button>
          </div>
          <button className="home-welcome-donate" onClick={onOpenDonate}>
            ☕ Curtiu? Paga um cafezin pro dev
          </button>
        </div>
      )}

      {notes.length > 0 && (
        <div className="home-recent">
          {/* Search */}
          <div className="home-search-row">
            <input
              ref={searchRef}
              className="home-search"
              type="text"
              placeholder="Buscar em todas as notas... (Ctrl+Shift+F)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Tags filter bar */}
          {allTags.length > 0 && !search.trim() && (
            <div className="home-tags-bar">
              <button
                className={`home-tag-pill ${activeTag === null ? "active" : ""}`}
                onClick={() => setActiveTag(null)}
              >
                Todas
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  className={`home-tag-pill ${activeTag === tag ? "active" : ""}`}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Section title */}
          <h2 className="home-recent-title">
            {isSearching
              ? "Buscando..."
              : search.trim()
                ? `Resultados (${displayNotes.length})`
                : activeTag
                  ? `Tag: ${activeTag} (${displayNotes.length})`
                  : "Recentes"}
          </h2>

          {/* Notes list */}
          <ul className="home-list">
            {displayNotes.map((note) => (
              <li
                key={note.id}
                className="home-item"
                onClick={() => onOpenNote(note.id)}
                onContextMenu={(e) => handleContextMenu(e, note.id)}
              >
                <div className="home-item-content">
                  <div className="home-item-top">
                    <div className="home-item-left">
                      {note.pinned && <span className="home-pin" title="Fixada">📌</span>}
                      <span className="home-item-title">
                        {note.title || "Sem título"}
                      </span>
                    </div>
                    <span className="home-item-date">
                      {new Date(note.updatedAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  {"snippet" in note && (note as SearchResult).snippet && (
                    <div className="home-item-snippet">
                      {(note as SearchResult).snippet}
                    </div>
                  )}
                  {note.tags && note.tags.length > 0 && (
                    <div className="home-item-tags">
                      {note.tags.map((tag) => (
                        <span key={tag} className="home-item-tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
            {displayNotes.length === 0 && (
              <li className="home-empty">
                {search.trim() ? "Nenhuma nota encontrada" : "Nenhuma nota com essa tag"}
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Tag editing modal */}
      {editingTagsFor && (
        <div className="home-tag-editor-overlay" onClick={() => setEditingTagsFor(null)}>
          <div className="home-tag-editor" onClick={(e) => e.stopPropagation()}>
            <h3 className="home-tag-editor-title">Editar tags</h3>
            <p className="home-tag-editor-hint">Separe tags com vírgula</p>
            <input
              ref={tagInputRef}
              className="home-tag-editor-input"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEditedTags();
                if (e.key === "Escape") setEditingTagsFor(null);
              }}
              placeholder="trabalho, ideias, projeto..."
            />
            <div className="home-tag-editor-actions">
              <button
                className="home-tag-editor-cancel"
                onClick={() => setEditingTagsFor(null)}
              >
                Cancelar
              </button>
              <button
                className="home-tag-editor-save"
                onClick={saveEditedTags}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      </>
      )}

      {/* Footer with support link */}
      <div className="home-footer">
        <button className="home-footer-link" onClick={onOpenDonate}>
          ☕ Apoiar o Inkflow
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="home-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="home-context-item"
            onClick={() => {
              onOpenNote(contextMenu.noteId);
              setContextMenu(null);
            }}
          >
            Abrir
          </button>
          <button
            className="home-context-item"
            onClick={() => {
              handleTogglePin(contextMenu.noteId);
              setContextMenu(null);
            }}
          >
            {notes.find((n) => n.id === contextMenu.noteId)?.pinned
              ? "Desafixar"
              : "Fixar"}
          </button>
          <button
            className="home-context-item"
            onClick={() => startEditingTags(contextMenu.noteId)}
          >
            Editar tags
          </button>
          <div className="home-context-divider" />
          <button
            className="home-context-item home-context-danger"
            onClick={() => {
              handleDelete(contextMenu.noteId);
              setContextMenu(null);
            }}
          >
            Deletar
          </button>
        </div>
      )}
    </div>
  );
}
