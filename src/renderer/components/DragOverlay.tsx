import React from "react";
import "../styles/drag-overlay.css";

interface DragOverlayProps {
  state: "idle" | "drag-over" | "importing";
  fileCount?: number;
}

export function DragOverlay({ state, fileCount = 0 }: DragOverlayProps) {
  if (state === "idle") return null;

  return (
    <div className={`drag-overlay drag-overlay--${state}`}>
      <div className="drag-overlay-inner">
        {state === "drag-over" && (
          <>
            <div className="drag-overlay-icon">📥</div>
            <div className="drag-overlay-title">
              Soltar para importar
              {fileCount > 0 && (
                <span className="drag-overlay-count">
                  {fileCount} {fileCount === 1 ? "nota" : "notas"}
                </span>
              )}
            </div>
            <div className="drag-overlay-hint">Arquivos .note</div>
          </>
        )}
        {state === "importing" && (
          <>
            <div className="drag-overlay-icon drag-overlay-icon--spin">⏳</div>
            <div className="drag-overlay-title">Importando...</div>
          </>
        )}
      </div>
    </div>
  );
}
