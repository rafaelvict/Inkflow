import React, { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { keymap, type ViewUpdate } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { checkboxPlugin, checkboxTheme } from "../editor/checkbox-extension";
import { wysiwygPlugin } from "../editor/wysiwyg-extension";
import { textStyleField } from "../editor/text-style-extension";
import {
  formatBold,
  formatItalic,
  formatCode,
  formatCheckbox,
  insertLink,
} from "../editor/format-commands";
import { clickableLinks } from "../editor/link-extension";

interface TextEditorProps {
  initialText: string;
  theme: "light" | "dark";
  fontFamily?: string;
  fontSize?: number;
  onChange: (text: string) => void;
  onCursorChange: (line: number, col: number) => void;
  onChecklistStats?: (checked: number, total: number) => void;
  onViewReady?: (view: EditorView) => void;
}

// Compartment for hot-swappable theme (no editor recreation)
const themeCompartment = new Compartment();
const wysiwygCompartment = new Compartment();

function getThemeExtension(theme: "light" | "dark") {
  return theme === "dark" ? oneDark : [];
}

/** Count checklist items in text */
function countChecklist(text: string): { checked: number; total: number } {
  let checked = 0;
  let total = 0;
  const re = /^\s*- \[( |x|X)\]/gm;
  let match;
  while ((match = re.exec(text)) !== null) {
    total++;
    if (match[1] === "x" || match[1] === "X") checked++;
  }
  return { checked, total };
}

/** Markdown formatting keybindings */
const formatKeymap = keymap.of([
  { key: "Mod-b", run: formatBold },
  { key: "Mod-i", run: formatItalic },
  { key: "Mod-`", run: formatCode },
  { key: "Mod-Shift-c", run: formatCheckbox },
  { key: "Mod-l", run: insertLink },
]);

export function TextEditor({
  initialText,
  theme,
  fontFamily,
  fontSize,
  onChange,
  onCursorChange,
  onChecklistStats,
  onViewReady,
}: TextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Stable callbacks via ref to avoid re-creating the editor
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCursorRef = useRef(onCursorChange);
  onCursorRef.current = onCursorChange;
  const onChecklistRef = useRef(onChecklistStats);
  onChecklistRef.current = onChecklistStats;
  const onViewReadyRef = useRef(onViewReady);
  onViewReadyRef.current = onViewReady;

  // Create editor ONCE
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: initialText,
      extensions: [
        formatKeymap, // Must be before basicSetup so our bindings take priority
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        checkboxPlugin,
        checkboxTheme,
        clickableLinks,
        textStyleField,          // ephemeral per-range font styles
        wysiwygCompartment.of(wysiwygPlugin),
        themeCompartment.of(getThemeExtension(theme)),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged) {
            const text = update.state.doc.toString();
            onChangeRef.current(text);

            // Report checklist stats
            if (onChecklistRef.current) {
              const stats = countChecklist(text);
              onChecklistRef.current(stats.checked, stats.total);
            }
          }
          const pos = update.state.selection.main.head;
          const line = update.state.doc.lineAt(pos);
          onCursorRef.current(line.number, pos - line.from + 1);
        }),
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;

    // Report initial checklist stats
    if (onChecklistRef.current) {
      const stats = countChecklist(initialText);
      onChecklistRef.current(stats.checked, stats.total);
    }

    // Expose view to parent
    onViewReadyRef.current?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Created ONCE

  // Reconfigure theme WITHOUT destroying editor
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeCompartment.reconfigure(getThemeExtension(theme)),
    });
  }, [theme]);

  // Sync content when loading a different note
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== initialText) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: initialText,
        },
      });

      // Report checklist stats for the new content
      if (onChecklistRef.current) {
        const stats = countChecklist(initialText);
        onChecklistRef.current(stats.checked, stats.total);
      }
    }
  }, [initialText]);

  return (
    <div
      ref={containerRef}
      className="text-editor"
      style={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        ...(fontFamily ? { "--editor-font-family": fontFamily } as React.CSSProperties : {}),
        ...(fontSize ? { "--editor-font-size": `${fontSize}px` } as React.CSSProperties : {}),
      }}
    />
  );
}
