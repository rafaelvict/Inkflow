import React, { useEffect, useState } from "react";
import "../styles/update-banner.css";

type BannerState =
  | { phase: "idle" }
  | { phase: "available"; version: string }
  | { phase: "downloading"; percent: number }
  | { phase: "ready"; version: string }
  | { phase: "error"; message: string };

export function UpdateBanner() {
  const [state, setState] = useState<BannerState>({ phase: "idle" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsub = window.electronAPI.update.onEvent((event) => {
      switch (event.type) {
        case "available":
          setState({ phase: "available", version: (event.version as string) ?? "?" });
          setDismissed(false);
          break;
        case "progress":
          setState({ phase: "downloading", percent: (event.percent as number) ?? 0 });
          break;
        case "downloaded":
          setState({ phase: "ready", version: (event.version as string) ?? "?" });
          setDismissed(false);
          break;
        case "error":
          setState({ phase: "error", message: (event.message as string) ?? "Erro desconhecido" });
          // Auto-dismiss errors after 8s
          setTimeout(() => setState({ phase: "idle" }), 8000);
          break;
        default:
          break;
      }
    });
    return unsub;
  }, []);

  if (state.phase === "idle" || dismissed) return null;

  const handleInstall = async () => {
    await window.electronAPI.update.install();
  };

  const handleDismiss = () => setDismissed(true);

  return (
    <div className="update-banner" role="status" aria-live="polite">
      {state.phase === "available" && (
        <>
          <span className="update-banner-icon">⬆️</span>
          <span className="update-banner-msg">
            Atualização disponível: <strong>v{state.version}</strong>
          </span>
          <span className="update-banner-note">(baixando em segundo plano…)</span>
          <button className="update-banner-dismiss" onClick={handleDismiss} aria-label="Dispensar">
            ×
          </button>
        </>
      )}

      {state.phase === "downloading" && (
        <>
          <span className="update-banner-icon">⬇️</span>
          <span className="update-banner-msg">Baixando atualização…</span>
          <div className="update-banner-progress">
            <div
              className="update-banner-progress-bar"
              style={{ width: `${state.percent}%` }}
            />
          </div>
          <span className="update-banner-pct">{state.percent}%</span>
        </>
      )}

      {state.phase === "ready" && (
        <>
          <span className="update-banner-icon">✅</span>
          <span className="update-banner-msg">
            v{state.version} pronta para instalar
          </span>
          <button className="update-banner-btn" onClick={handleInstall}>
            Instalar e reiniciar
          </button>
          <button className="update-banner-dismiss" onClick={handleDismiss} aria-label="Depois">
            Depois
          </button>
        </>
      )}

      {state.phase === "error" && (
        <>
          <span className="update-banner-icon">⚠️</span>
          <span className="update-banner-msg">Erro ao verificar atualização: {state.message}</span>
          <button className="update-banner-dismiss" onClick={handleDismiss} aria-label="Fechar">
            ×
          </button>
        </>
      )}
    </div>
  );
}
