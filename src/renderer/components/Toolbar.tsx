import React from "react";
import "../styles/toolbar.css";

type ViewMode = "split" | "text-only" | "canvas-only";

type ThemeOption = "light" | "dark";

interface ToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onNew: () => void;
  onSave: () => void;
  onHome: () => void;
  dirty: boolean;
  aiPanelOpen: boolean;
  onToggleAiPanel: () => void;
  onShare?: () => void;
  onOpenTemplates?: () => void;
  theme?: ThemeOption;
  onToggleTheme?: () => void;
  isLoggedIn?: boolean;
  isPro?: boolean;
}

export function Toolbar({
  viewMode,
  onViewModeChange,
  onNew,
  onSave,
  onHome,
  dirty,
  aiPanelOpen,
  onToggleAiPanel,
  onShare,
  onOpenTemplates,
  theme,
  onToggleTheme,
  isLoggedIn,
  isPro,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button
          className="toolbar-btn"
          onClick={onHome}
          title="Notas recentes (Ctrl+O)"
        >
          ⌂
        </button>
        <button
          className="toolbar-btn"
          onClick={onNew}
          title="Nova nota (Ctrl+N)"
        >
          Novo
        </button>
        <button
          className="toolbar-btn"
          onClick={onSave}
          title="Salvar agora (Ctrl+S)"
        >
          Salvar
        </button>
        {onOpenTemplates && (
          <button
            className="toolbar-btn"
            onClick={onOpenTemplates}
            title="Inserir template no canvas atual"
          >
            📑
          </button>
        )}
        {isLoggedIn && isPro && onShare && (
          <button
            className="toolbar-btn"
            onClick={onShare}
            title="Compartilhar nota com time"
          >
            🔗
          </button>
        )}
      </div>
      <div className="toolbar-center">
        <button
          className={`toolbar-mode ${viewMode === "split" ? "active" : ""}`}
          onClick={() => onViewModeChange("split")}
          title="Texto e Canvas lado a lado (Ctrl+1)"
        >
          Split
        </button>
        <button
          className={`toolbar-mode ${viewMode === "text-only" ? "active" : ""}`}
          onClick={() => onViewModeChange("text-only")}
          title="Só editor de texto (Ctrl+2)"
        >
          Texto
        </button>
        <button
          className={`toolbar-mode ${viewMode === "canvas-only" ? "active" : ""}`}
          onClick={() => onViewModeChange("canvas-only")}
          title="Só canvas Excalidraw (Ctrl+3)"
        >
          Canvas
        </button>
      </div>
      <div className="toolbar-right">
        <button
          className={`toolbar-btn ${aiPanelOpen ? "active" : ""}`}
          onClick={onToggleAiPanel}
          title="Gerar diagrama com IA (Ollama)"
          style={{ fontSize: "15px" }}
        >
          ✨
        </button>
        {onToggleTheme && (
          <button
            className="toolbar-btn"
            onClick={onToggleTheme}
            title={`Tema: ${theme === "dark" ? "escuro" : "claro"}`}
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
        )}
      </div>
    </div>
  );
}
