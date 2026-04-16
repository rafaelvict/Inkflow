import React from "react";
import "../styles/donate.css";

interface DonateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "light" | "dark";
}

export function DonateDialog({ isOpen, onClose, theme }: DonateDialogProps) {
  if (!isOpen) return null;

  const openExternal = (url: string) => {
    window.electronAPI.shell.openExternal(url);
  };

  return (
    <div className="donate-overlay" onClick={onClose}>
      <div
        className={`donate-dialog theme-${theme}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Apoiar o Inkflow"
      >
        <div className="donate-header">
          <h2 className="donate-title">☕ Apoiar o Inkflow</h2>
          <button className="donate-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="donate-body">
          <p className="donate-hero">
            Opa, ce ta usando o Inkflow? Que beleza!
          </p>
          <p className="donate-text">
            Esse projeto eh feito com carinho (e muito cafe). Se ele te ajuda no dia a dia,
            considera dar aquela forca pra gente continuar melhorando. Qualquer valor ja
            ajuda demais, uai!
          </p>

          <div className="donate-options">
            <button
              className="donate-option"
              onClick={() => openExternal("https://buymeacoffee.com/inkflow")}
            >
              <span className="donate-option-icon">☕</span>
              <span className="donate-option-label">Buy Me a Coffee</span>
              <span className="donate-option-hint">Doacao unica ou recorrente</span>
            </button>

            <button
              className="donate-option"
              onClick={() => openExternal("https://github.com/sponsors/Inkflow")}
            >
              <span className="donate-option-icon">💜</span>
              <span className="donate-option-label">GitHub Sponsors</span>
              <span className="donate-option-hint">Apoio mensal via GitHub</span>
            </button>

            <div className="donate-pix">
              <span className="donate-pix-label">PIX:</span>
              <code className="donate-pix-key">inkflow@users.noreply.github.com</code>
              <button
                className="donate-pix-copy"
                onClick={() => {
                  navigator.clipboard.writeText("inkflow@users.noreply.github.com");
                }}
                title="Copiar chave PIX"
              >
                📋
              </button>
            </div>
          </div>

          <p className="donate-thanks">
            Valeu demais! 🤝
          </p>
        </div>

        <div className="donate-footer">
          <button className="donate-btn donate-btn--ghost" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
