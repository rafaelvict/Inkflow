import React, { useEffect, useState } from "react";
import "../styles/ai-settings.css";

interface AiSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "light" | "dark";
}

export function AiSettingsDialog({ isOpen, onClose, theme }: AiSettingsDialogProps) {
  const [ollamaUrl, setOllamaUrl] = useState("");
  const [model, setModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "testing" | "saving" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setStatus("idle");
    setErrorMsg("");
    setAvailableModels([]);
    window.electronAPI.ai.getSettings().then((s) => {
      setOllamaUrl(s.ollamaUrl);
      setModel(s.model);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setStatus("testing");
    setErrorMsg("");
    setAvailableModels([]);

    const result = await window.electronAPI.ai.testConnection(ollamaUrl.trim());
    if (result.ok) {
      setAvailableModels(result.models ?? []);
      setStatus("ok");
      setTimeout(() => {
        if (status === "ok") setStatus("idle");
      }, 3000);
    } else {
      setErrorMsg(result.error ?? "Falha na conexao");
      setStatus("error");
    }
  };

  const handleSave = async () => {
    setStatus("saving");
    setErrorMsg("");
    try {
      const saved = await window.electronAPI.ai.saveSettings({
        ollamaUrl: ollamaUrl.trim(),
        model: model.trim(),
      });
      setOllamaUrl(saved.ollamaUrl);
      setModel(saved.model);
      setStatus("ok");
      setTimeout(() => onClose(), 800);
    } catch (e: any) {
      setErrorMsg(e.message ?? "Erro ao salvar");
      setStatus("error");
    }
  };

  const busy = status === "testing" || status === "saving";

  return (
    <div className="ais-overlay" onClick={onClose}>
      <div
        className={`ais-dialog theme-${theme}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Configuracoes de IA"
      >
        <div className="ais-header">
          <h2 className="ais-title">🤖 Configuracoes de IA</h2>
          <button className="ais-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="ais-body">
          <p className="ais-description">
            Configure a conexao com o <strong>Ollama</strong> para gerar diagramas com IA local.
            O Ollama precisa estar rodando (<code>ollama serve</code>).
          </p>

          <label className="ais-label">URL do Ollama</label>
          <input
            className="ais-input"
            type="text"
            value={ollamaUrl}
            onChange={(e) => setOllamaUrl(e.target.value)}
            placeholder="http://localhost:11434"
            disabled={busy}
          />

          <div className="ais-row">
            <button
              className="ais-btn ais-btn--secondary"
              onClick={handleTestConnection}
              disabled={busy || !ollamaUrl.trim()}
            >
              {status === "testing" ? "Testando…" : "Testar conexao"}
            </button>
            {status === "ok" && availableModels.length > 0 && (
              <span className="ais-connected">Conectado — {availableModels.length} modelo(s)</span>
            )}
          </div>

          {status === "error" && (
            <div className="ais-alert ais-alert--error">⚠️ {errorMsg}</div>
          )}

          <label className="ais-label">Modelo</label>
          {availableModels.length > 0 ? (
            <select
              className="ais-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={busy}
            >
              {!availableModels.includes(model) && (
                <option value={model}>{model} (nao encontrado)</option>
              )}
              {availableModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input
              className="ais-input"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="qwen2.5:1.5b"
              disabled={busy}
            />
          )}

          <div className="ais-note">
            <strong>💡 Dica:</strong> Modelos pequenos (1.5B–7B) funcionam bem para diagramas simples.
            Use <code>ollama pull qwen2.5:1.5b</code> para baixar.
          </div>
        </div>

        <div className="ais-footer">
          <button
            className="ais-btn ais-btn--primary"
            onClick={handleSave}
            disabled={busy || !ollamaUrl.trim() || !model.trim()}
          >
            {status === "saving" ? "Salvando…" : "Salvar"}
          </button>
          <button className="ais-btn ais-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
