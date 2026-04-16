import React from "react";
import "../styles/statusbar.css";

type ViewMode = "split" | "text-only" | "canvas-only";
type SaveStatus = "saved" | "saving" | "unsaved";
type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

interface StatusBarProps {
  line: number;
  col: number;
  dirty: boolean;
  viewMode: ViewMode;
  checklistChecked?: number;
  checklistTotal?: number;
  saveStatus?: SaveStatus;
  syncStatus?: SyncStatus;
  syncQueueSize?: number;
}

export function StatusBar({
  line,
  col,
  dirty,
  viewMode,
  checklistChecked = 0,
  checklistTotal = 0,
  saveStatus = "saved",
  syncStatus = "idle",
  syncQueueSize = 0,
}: StatusBarProps) {
  const saveLabel =
    saveStatus === "saving"
      ? "Salvando..."
      : saveStatus === "unsaved" || dirty
        ? "Não salvo •"
        : "Salvo ✓";

  const saveClass =
    saveStatus === "saving"
      ? "statusbar-saving"
      : saveStatus === "unsaved" || dirty
        ? "statusbar-unsaved"
        : "statusbar-saved";

  return (
    <div className="statusbar">
      <span className="statusbar-item">
        Ln {line}, Col {col}
      </span>
      <span className="statusbar-item">UTF-8</span>
      <span className="statusbar-item">
        {viewMode === "split"
          ? "Split"
          : viewMode === "text-only"
            ? "Texto"
            : "Canvas"}
      </span>
      {checklistTotal > 0 && (
        <span className="statusbar-item statusbar-checklist">
          ☑ {checklistChecked}/{checklistTotal}
        </span>
      )}
      <span className={`statusbar-item ${saveClass}`}>{saveLabel}</span>
      {syncStatus !== "idle" && (
        <span className={`statusbar-item statusbar-sync statusbar-sync--${syncStatus}`}>
          {syncStatus === "syncing" && "Sincronizando…"}
          {syncStatus === "synced" && "Sync ✓"}
          {syncStatus === "offline" && `Offline${syncQueueSize > 0 ? ` (${syncQueueSize})` : ""}`}
          {syncStatus === "error" && "Sync ✗"}
        </span>
      )}
      <span className="statusbar-item statusbar-shortcut">Ctrl+K</span>
    </div>
  );
}
