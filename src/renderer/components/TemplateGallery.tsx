import React, { useEffect, useState } from "react";
import "../styles/template-gallery.css";

interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface TemplateGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onNoteCreated: (noteId: string) => void;
  /** When set, shows "Importar" option to merge template into current canvas */
  onImportToCanvas?: (sceneJson: string) => void;
  theme: "light" | "dark";
}

export function TemplateGallery({ isOpen, onClose, onNoteCreated, onImportToCanvas, theme }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    window.electronAPI.templates.list().then(setTemplates);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUseTemplate = async (templateId: string) => {
    setCreating(templateId);
    const result = await window.electronAPI.templates.createNote(templateId);
    setCreating(null);
    if (result.ok && result.id) {
      onNoteCreated(result.id);
      onClose();
    }
  };

  const handleImportTemplate = async (templateId: string) => {
    if (!onImportToCanvas) return;
    setCreating(templateId);
    try {
      const scene = await window.electronAPI.templates.getScene(templateId);
      if (scene) {
        onImportToCanvas(scene);
        onClose();
      }
    } catch {
      // fallback: create as new note
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="tg-overlay" onClick={onClose}>
      <div
        className={`tg-dialog theme-${theme}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Templates"
      >
        <div className="tg-header">
          <h2 className="tg-title">📑 Templates</h2>
          <button className="tg-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <p className="tg-description">
          Escolha um template para criar uma nota com conteudo e diagrama prontos.
        </p>

        <div className="tg-grid">
          {templates.map((t) => (
            <div key={t.id} className="tg-card">
              <span className="tg-card-icon">{t.icon}</span>
              <span className="tg-card-name">{t.name}</span>
              <span className="tg-card-desc">{t.description}</span>
              {creating === t.id && <span className="tg-card-loading">Criando…</span>}
              <div className="tg-card-actions">
                <button
                  className="tg-card-btn tg-card-btn--primary"
                  onClick={() => handleUseTemplate(t.id)}
                  disabled={creating !== null}
                >
                  Nova nota
                </button>
                {onImportToCanvas && (
                  <button
                    className="tg-card-btn tg-card-btn--secondary"
                    onClick={() => handleImportTemplate(t.id)}
                    disabled={creating !== null}
                    title="Adicionar ao canvas atual"
                  >
                    Importar aqui
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="tg-footer">
          <button className="tg-btn tg-btn--ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
