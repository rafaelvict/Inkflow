import React from "react";
import "../styles/about.css";
import iconPng from "../../../build/icon.png";

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "light" | "dark";
}

// ============================================================
// CONFIGURE SEUS LINKS AQUI:
// ============================================================
const SUPPORT_URL = "https://buymeacoffee.com/inkflow"; // Buy Me a Coffee, Ko-fi, GitHub Sponsors, etc.
const WEBSITE_URL = "https://inkflow.app"; // Seu site (ou GitHub repo)
const GITHUB_URL = "https://github.com/inkflow/inkflow"; // Repo do projeto
// ============================================================

const APP_VERSION = "0.5.0";

export function AboutDialog({ isOpen, onClose, theme }: AboutDialogProps) {
  if (!isOpen) return null;

  const handleOpenLink = (url: string) => {
    window.electronAPI.shell.openExternal(url);
  };

  return (
    <div className="about-overlay" onClick={onClose}>
      <div
        className={`about-dialog theme-${theme}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="about-logo">
          <img src={iconPng} alt="Inkflow" className="about-logo-img" />
        </div>
        <h2 className="about-name">Inkflow</h2>
        <p className="about-version">Versão {APP_VERSION}</p>
        <p className="about-desc">
          Bloco de notas com superpoderes visuais.
          <br />
          Texto + Canvas Excalidraw no mesmo app.
        </p>

        <div className="about-links">
          <button
            className="about-support-btn"
            onClick={() => handleOpenLink(SUPPORT_URL)}
          >
            ☕ Apoiar o projeto
          </button>
          <button
            className="about-link-btn"
            onClick={() => handleOpenLink(GITHUB_URL)}
          >
            GitHub
          </button>
          <button
            className="about-link-btn"
            onClick={() => handleOpenLink(WEBSITE_URL)}
          >
            Site
          </button>
        </div>

        <p className="about-credits">
          Feito com ❤️ usando Excalidraw, CodeMirror e Electron.
          <br />
          © {new Date().getFullYear()} Inkflow. MIT License.
        </p>

        <button className="about-close" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}

export { SUPPORT_URL, GITHUB_URL, WEBSITE_URL };
