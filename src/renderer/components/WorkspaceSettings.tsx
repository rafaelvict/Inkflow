import React, { useEffect, useState } from "react";
import "../styles/workspace-settings.css";

interface WorkspaceSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "light" | "dark";
}

export function WorkspaceSettings({ isOpen, onClose, theme }: WorkspaceSettingsProps) {
  const [currentPath, setCurrentPath] = useState("");
  const [defaultPath, setDefaultPath] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    window.electronAPI.workspace2.getPath().then(({ path, default: def }) => {
      setCurrentPath(path);
      setDefaultPath(def);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const isDefault = currentPath === defaultPath;

  const handleChooseFolder = async () => {
    const result = await window.electronAPI.workspace2.choosePath();
    if (result.canceled || !result.path) return;
    await applyPath(result.path);
  };

  const applyPath = async (newPath: string) => {
    setStatus("saving");
    setErrorMsg("");
    try {
      const result = await window.electronAPI.workspace2.setPath(newPath);
      if (result.ok) {
        setCurrentPath(result.path ?? newPath);
        setStatus("ok");
        setTimeout(() => setStatus("idle"), 2500);
      } else {
        setErrorMsg(result.error ?? "Erro desconhecido");
        setStatus("error");
      }
    } catch (e: any) {
      setErrorMsg(e.message ?? "Erro desconhecido");
      setStatus("error");
    }
  };

  const handleReset = async () => {
    setStatus("saving");
    const result = await window.electronAPI.workspace2.resetPath();
    if (result.ok) {
      setCurrentPath(result.path ?? defaultPath);
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2500);
    }
  };

  return (
    <div className="ws-overlay" onClick={onClose}>
      <div
        className={`ws-dialog theme-${theme}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Configurações de workspace"
      >
        <div className="ws-header">
          <h2 className="ws-title">📁 Pasta de notas</h2>
          <button className="ws-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="ws-body">
          <p className="ws-description">
            Escolha onde as notas são salvas. Usar uma pasta do{" "}
            <strong>Dropbox, OneDrive ou Google Drive</strong> sincroniza suas
            notas entre dispositivos automaticamente.
          </p>

          <div className="ws-path-box">
            <span className="ws-path-label">Pasta atual:</span>
            <span className="ws-path-value" title={currentPath}>
              {currentPath}
            </span>
            {isDefault && <span className="ws-badge">padrão</span>}
          </div>

          {status === "ok" && (
            <div className="ws-alert ws-alert--ok">
              ✅ Pasta atualizada. Novas notas serão salvas aqui.
            </div>
          )}
          {status === "error" && (
            <div className="ws-alert ws-alert--error">⚠️ {errorMsg}</div>
          )}

          <div className="ws-note">
            <strong>💡 Dica:</strong> O app detecta novas notas adicionadas externamente
            (por outro dispositivo) e atualiza a lista automaticamente.
          </div>
        </div>

        <div className="ws-footer">
          <button
            className="ws-btn ws-btn--primary"
            onClick={handleChooseFolder}
            disabled={status === "saving"}
          >
            {status === "saving" ? "Salvando…" : "Alterar pasta…"}
          </button>
          {!isDefault && (
            <button
              className="ws-btn ws-btn--secondary"
              onClick={handleReset}
              disabled={status === "saving"}
            >
              Restaurar padrão
            </button>
          )}
          <button className="ws-btn ws-btn--ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
