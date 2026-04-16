import React from "react";
import { FORMAT_ACTIONS, type FormatAction } from "../editor/format-commands";
import { FONT_OPTIONS, type EditorPrefs } from "../hooks/useEditorPrefs";
import {
  applyFontSizeToSelection,
  applyFontFamilyToSelection,
  hasTextSelection,
} from "../editor/text-style-extension";
import type { EditorView } from "@codemirror/view";
import "../styles/format-toolbar.css";

interface FormatToolbarProps {
  editorView: EditorView | null;
  editorPrefs: EditorPrefs;
  onFontFamilyChange: (family: string) => void;
  onFontSizeIncrease: () => void;
  onFontSizeDecrease: () => void;
}

export function FormatToolbar({
  editorView,
  editorPrefs,
  onFontFamilyChange,
  onFontSizeIncrease,
  onFontSizeDecrease,
}: FormatToolbarProps) {
  const handleAction = (action: FormatAction) => {
    if (editorView) {
      action.action(editorView);
    }
  };

  /**
   * Increase font size:
   * - With selection → apply larger font only to selected range (visual, ephemeral).
   * - Without selection → change global editor preference.
   */
  const handleFontSizeIncrease = () => {
    if (editorView && hasTextSelection(editorView)) {
      // Derive target size: current pref + 2px as a reasonable step
      const targetSize = editorPrefs.fontSize + 2;
      applyFontSizeToSelection(editorView, targetSize);
      editorView.focus();
    } else {
      onFontSizeIncrease();
    }
  };

  /**
   * Decrease font size:
   * - With selection → apply smaller font only to selected range.
   * - Without selection → change global editor preference.
   */
  const handleFontSizeDecrease = () => {
    if (editorView && hasTextSelection(editorView)) {
      const targetSize = Math.max(editorPrefs.fontSize - 2, 8);
      applyFontSizeToSelection(editorView, targetSize);
      editorView.focus();
    } else {
      onFontSizeDecrease();
    }
  };

  /**
   * Font family change:
   * - With selection → apply font family only to selected range.
   * - Without selection → change global editor preference.
   */
  const handleFontFamilyChange = (family: string) => {
    if (editorView && hasTextSelection(editorView)) {
      applyFontFamilyToSelection(editorView, family);
      editorView.focus();
    } else {
      onFontFamilyChange(family);
    }
  };

  return (
    <div className="format-toolbar">
      {/* Font family selector */}
      <select
        className="format-font-select"
        value={editorPrefs.fontFamily}
        onChange={(e) => handleFontFamilyChange(e.target.value)}
        title="Fonte (selecione texto para aplicar só ao trecho; sem seleção muda o editor todo)"
        aria-label="Fonte do editor"
      >
        {FONT_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Font size controls */}
      <button
        className="format-btn"
        onClick={handleFontSizeDecrease}
        title="Diminuir fonte (Ctrl+-) — aplica ao texto selecionado ou ao editor todo"
        aria-label="Diminuir fonte"
      >
        <span className="format-btn-icon" style={{ fontSize: "10px", fontWeight: 700 }}>A</span>
      </button>
      <span className="format-font-size-label">{editorPrefs.fontSize}px</span>
      <button
        className="format-btn"
        onClick={handleFontSizeIncrease}
        title="Aumentar fonte (Ctrl+=) — aplica ao texto selecionado ou ao editor todo"
        aria-label="Aumentar fonte"
      >
        <span className="format-btn-icon" style={{ fontSize: "14px", fontWeight: 700 }}>A</span>
      </button>

      <div className="format-sep" />

      {FORMAT_ACTIONS.map((action) => {
        if (action.id.startsWith("sep")) {
          return <div key={action.id} className="format-sep" />;
        }
        return (
          <button
            key={action.id}
            className="format-btn"
            onClick={() => handleAction(action)}
            title={
              action.shortcut
                ? `${action.label} (${action.shortcut})`
                : action.label
            }
            disabled={!editorView}
          >
            <span className="format-btn-icon">{action.icon}</span>
          </button>
        );
      })}
    </div>
  );
}
