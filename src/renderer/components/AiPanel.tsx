import React, { useState, useRef, useEffect } from "react";
import "../styles/ai-panel.css";

interface AiPanelProps {
  /** Text pre-filled from editor selection — empty string if none */
  selectionText?: string;
  /** Called when elements are ready to be drawn on canvas */
  onElementsReady?: (elements: any[]) => void;
  /** Open AI settings dialog */
  onOpenSettings?: () => void;
}

export function AiPanel({ selectionText = "", onElementsReady, onOpenSettings }: AiPanelProps) {
  const [prompt, setPrompt] = useState(selectionText);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [error, setError] = useState("");
  const [elementCount, setElementCount] = useState(0);
  const [modelName, setModelName] = useState("...");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    window.electronAPI.ai.getSettings().then((s) => setModelName(s.model));
  }, []);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      textareaRef.current?.focus();
      return;
    }

    setStatus("loading");
    setError("");
    setElementCount(0);

    try {
      const result = await window.electronAPI.ai.draw(trimmed);

      if (!result.ok || !result.elements) {
        setStatus("error");
        setError(result.error ?? "Erro desconhecido");
        return;
      }

      setElementCount(result.elements.length);
      setStatus("done");
      onElementsReady?.(result.elements);
    } catch (e: any) {
      setStatus("error");
      setError(e.message ?? "Erro ao conectar com o Ollama");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter submits
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <span className="ai-panel-title">✨ Gerar Diagrama com IA</span>
        <span className="ai-panel-hint">Powered by Ollama</span>
      </div>

      <div className="ai-panel-body">
        <textarea
          ref={textareaRef}
          className="ai-panel-input"
          placeholder="Descreva o diagrama… ex: fluxograma de login com 3 etapas"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          disabled={status === "loading"}
        />

        <div className="ai-panel-actions">
          <button
            className="ai-panel-btn primary"
            onClick={handleGenerate}
            disabled={status === "loading" || !prompt.trim()}
          >
            {status === "loading" ? (
              <><span className="ai-spinner" /> Gerando…</>
            ) : (
              "Gerar Diagrama"
            )}
          </button>

          {status !== "idle" && (
            <button
              className="ai-panel-btn secondary"
              onClick={() => {
                setStatus("idle");
                setError("");
                setElementCount(0);
              }}
            >
              Limpar
            </button>
          )}
        </div>

        {status === "error" && (
          <div className="ai-panel-error">
            <span className="ai-panel-error-icon">⚠</span>
            {error}
          </div>
        )}

        {status === "done" && (
          <div className="ai-panel-success">
            ✅ {elementCount} elementos adicionados ao canvas
          </div>
        )}

        <div className="ai-panel-footer">
          <span>Ctrl+Enter para gerar · Modelo: {modelName}</span>
          {onOpenSettings && (
            <button
              className="ai-panel-btn secondary ai-panel-settings-btn"
              onClick={onOpenSettings}
              title="Configuracoes de IA"
            >
              ⚙
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
