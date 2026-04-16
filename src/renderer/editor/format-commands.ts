/**
 * Markdown formatting commands for CodeMirror 6.
 *
 * Each function operates on the current selection(s):
 * - If text is selected, wraps it with the appropriate syntax.
 * - If no text is selected, inserts a placeholder.
 * - For line-level formats (heading, list), operates on the full line.
 */
import type { EditorView } from "@codemirror/view";

/** Wrap selection with inline markers (e.g. ** for bold, * for italic) */
function toggleInlineFormat(view: EditorView, marker: string): boolean {
  const { state } = view;
  const changes: { from: number; to: number; insert: string }[] = [];

  for (const range of state.selection.ranges) {
    const selected = state.sliceDoc(range.from, range.to);

    if (
      selected.startsWith(marker) &&
      selected.endsWith(marker) &&
      selected.length >= marker.length * 2
    ) {
      // Remove markers
      changes.push({
        from: range.from,
        to: range.to,
        insert: selected.slice(marker.length, -marker.length),
      });
    } else {
      // Add markers
      const text = selected || "texto";
      changes.push({
        from: range.from,
        to: range.to,
        insert: `${marker}${text}${marker}`,
      });
    }
  }

  if (changes.length > 0) {
    view.dispatch({ changes });
    view.focus();
  }
  return true;
}

/** Toggle heading level on current line(s). Cycles: none → # → ## → ### → none */
function toggleHeading(view: EditorView, level: number): boolean {
  const { state } = view;
  const prefix = "#".repeat(level) + " ";
  const changes: { from: number; to: number; insert: string }[] = [];
  const touchedLines = new Set<number>();

  for (const range of state.selection.ranges) {
    const lines = linesInRange(state, range.from, range.to);
    const allHaveLevel = lines.every((l) => /^(#{1,6})\s/.exec(l.text)?.[1].length === level);

    for (const line of lines) {
      if (touchedLines.has(line.number)) continue;
      touchedLines.add(line.number);

      const text = line.text;
      const headingMatch = /^(#{1,6})\s/.exec(text);

      if (allHaveLevel) {
        // Remove heading
        changes.push({
          from: line.from,
          to: line.from + headingMatch![0].length,
          insert: "",
        });
      } else if (headingMatch) {
        // Replace with new level
        changes.push({
          from: line.from,
          to: line.from + headingMatch[0].length,
          insert: prefix,
        });
      } else {
        // Add heading
        changes.push({
          from: line.from,
          to: line.from,
          insert: prefix,
        });
      }
    }
  }

  if (changes.length > 0) {
    view.dispatch({ changes });
    view.focus();
  }
  return true;
}

/** Collect all unique lines touched by a selection range */
function linesInRange(
  state: import("@codemirror/state").EditorState,
  from: number,
  to: number,
): import("@codemirror/state").Line[] {
  const lines: import("@codemirror/state").Line[] = [];
  const seen = new Set<number>();
  let pos = from;
  while (pos <= to) {
    const line = state.doc.lineAt(pos);
    if (!seen.has(line.number)) {
      seen.add(line.number);
      lines.push(line);
    }
    pos = line.to + 1;
    if (pos > to && lines.length > 0) break;
  }
  // Always include at least the line at `from`
  if (lines.length === 0) lines.push(state.doc.lineAt(from));
  return lines;
}

/** Toggle a line prefix (- , 1. , - [ ] ) — works on all selected lines */
function toggleLinePrefix(
  view: EditorView,
  prefix: string,
  pattern: RegExp,
): boolean {
  const { state } = view;
  const changes: { from: number; to: number; insert: string }[] = [];
  const touchedLines = new Set<number>();

  for (const range of state.selection.ranges) {
    const lines = linesInRange(state, range.from, range.to);

    // Determine intent: if ALL lines already have the prefix → remove; otherwise → add
    const allHavePrefix = lines.every((l) => pattern.test(l.text));

    for (const line of lines) {
      if (touchedLines.has(line.number)) continue;
      touchedLines.add(line.number);

      const text = line.text;

      if (allHavePrefix) {
        // Remove prefix
        const match = pattern.exec(text)!;
        changes.push({
          from: line.from,
          to: line.from + match[0].length,
          insert: "",
        });
      } else {
        // Strip any existing list prefix first, then add new one
        const existingPrefix = /^(\s*)([-*]\s\[[ xX]\]\s|[-*]\s|\d+\.\s)/.exec(text);
        if (existingPrefix) {
          changes.push({
            from: line.from,
            to: line.from + existingPrefix[0].length,
            insert: existingPrefix[1] + prefix,
          });
        } else {
          const indent = /^(\s*)/.exec(text)?.[1] ?? "";
          changes.push({
            from: line.from + indent.length,
            to: line.from + indent.length,
            insert: prefix,
          });
        }
      }
    }
  }

  if (changes.length > 0) {
    view.dispatch({ changes });
    view.focus();
  }
  return true;
}

/** Insert a markdown link at cursor */
function insertLink(view: EditorView): boolean {
  const { state } = view;
  const changes: { from: number; to: number; insert: string }[] = [];

  for (const range of state.selection.ranges) {
    const selected = state.sliceDoc(range.from, range.to);
    if (selected) {
      changes.push({
        from: range.from,
        to: range.to,
        insert: `[${selected}](url)`,
      });
    } else {
      changes.push({
        from: range.from,
        to: range.to,
        insert: "[texto](url)",
      });
    }
  }

  if (changes.length > 0) {
    view.dispatch({ changes });
    view.focus();
  }
  return true;
}

/** Insert horizontal rule */
function insertHorizontalRule(view: EditorView): boolean {
  const { state } = view;
  const pos = state.selection.main.from;
  const line = state.doc.lineAt(pos);

  view.dispatch({
    changes: { from: line.to, to: line.to, insert: "\n\n---\n\n" },
  });
  view.focus();
  return true;
}

// --- Exported command functions ---

export const formatBold = (view: EditorView) =>
  toggleInlineFormat(view, "**");

export const formatItalic = (view: EditorView) =>
  toggleInlineFormat(view, "*");

export const formatStrikethrough = (view: EditorView) =>
  toggleInlineFormat(view, "~~");

export const formatCode = (view: EditorView) =>
  toggleInlineFormat(view, "`");

export const formatH1 = (view: EditorView) => toggleHeading(view, 1);
export const formatH2 = (view: EditorView) => toggleHeading(view, 2);
export const formatH3 = (view: EditorView) => toggleHeading(view, 3);

export const formatBulletList = (view: EditorView) =>
  toggleLinePrefix(view, "- ", /^(\s*)[-*]\s(?!\[)/);

export const formatNumberedList = (view: EditorView) =>
  toggleLinePrefix(view, "1. ", /^(\s*)\d+\.\s/);

export const formatCheckbox = (view: EditorView) =>
  toggleLinePrefix(view, "- [ ] ", /^(\s*)[-*]\s\[[ xX]\]\s/);

export { insertLink, insertHorizontalRule };

/** Info about available formatting actions (for toolbar) */
export interface FormatAction {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  action: (view: EditorView) => boolean;
}

export const FORMAT_ACTIONS: FormatAction[] = [
  { id: "bold", label: "Negrito", icon: "B", shortcut: "Ctrl+B", action: formatBold },
  { id: "italic", label: "Itálico", icon: "I", shortcut: "Ctrl+I", action: formatItalic },
  { id: "strikethrough", label: "Tachado", icon: "S̶", action: formatStrikethrough },
  { id: "code", label: "Código", icon: "<>", shortcut: "Ctrl+`", action: formatCode },
  { id: "sep1", label: "", icon: "", action: () => false },
  { id: "h1", label: "Título 1", icon: "H1", action: formatH1 },
  { id: "h2", label: "Título 2", icon: "H2", action: formatH2 },
  { id: "h3", label: "Título 3", icon: "H3", action: formatH3 },
  { id: "sep2", label: "", icon: "", action: () => false },
  { id: "bullet", label: "Lista", icon: "•", action: formatBulletList },
  { id: "numbered", label: "Lista numerada", icon: "1.", action: formatNumberedList },
  { id: "checkbox", label: "Checklist", icon: "☐", shortcut: "Ctrl+Shift+C", action: formatCheckbox },
  { id: "sep3", label: "", icon: "", action: () => false },
  { id: "link", label: "Link", icon: "🔗", shortcut: "Ctrl+L", action: insertLink },
  { id: "hr", label: "Separador", icon: "—", action: insertHorizontalRule },
];
