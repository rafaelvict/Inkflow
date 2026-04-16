/**
 * WYSIWYG extension for CodeMirror 6.
 *
 * Hides markdown syntax markers (**, *, ~~, `, #, -, 1., [url]) on lines
 * where the cursor is NOT currently positioned — revealing clean rendered text.
 * When the cursor enters a line, the raw markdown syntax reappears for editing.
 *
 * Uses ViewPlugin (same pattern as checkbox-extension.ts) for viewport-scoped
 * incremental updates.
 *
 * Supported:
 *   Inline:  **bold**, *italic*, ~~strike~~, `code`
 *   Block:   # Heading 1/2/3, - list, 1. list, [text](url)
 *
 * Checklists (- [ ] / - [x] ) are intentionally excluded — handled by checkbox-extension.
 */
import {
  EditorView,
  Decoration,
  ViewPlugin,
  type ViewUpdate,
  type DecorationSet,
} from "@codemirror/view";
import type { Range } from "@codemirror/state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if any cursor/selection overlaps [from, to] */
function cursorInRange(
  view: EditorView,
  from: number,
  to: number,
): boolean {
  for (const r of view.state.selection.ranges) {
    // Use a small tolerance: if cursor head is anywhere on [from, to]
    if (r.from <= to && r.to >= from) return true;
  }
  return false;
}

/** Returns true if the line contains any cursor */
function cursorOnLine(view: EditorView, lineFrom: number, lineTo: number): boolean {
  for (const r of view.state.selection.ranges) {
    if (r.from <= lineTo && r.to >= lineFrom) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Inline patterns — each entry: [openMarker, closeMarker]
// We hide the markers when cursor is NOT on the line.
// ---------------------------------------------------------------------------

const INLINE_PATTERNS: Array<{
  re: RegExp;
  // group indices for open and close marker spans within the full match
  openGroup: number;
  closeGroup: number;
}> = [
  // **bold** — avoid matching ***
  {
    re: /(\*\*)([^*\n]+?)(\*\*)/g,
    openGroup: 1,
    closeGroup: 3,
  },
  // *italic* — avoid matching ** and standalone *
  {
    re: /(?<!\*)(\*)(?!\*)([^*\n]+?)(?<!\*)(\*)(?!\*)/g,
    openGroup: 1,
    closeGroup: 3,
  },
  // ~~strikethrough~~
  {
    re: /(~~)([^~\n]+?)(~~)/g,
    openGroup: 1,
    closeGroup: 3,
  },
  // `inline code`
  {
    re: /(`+)([^`\n]+?)(`+)/g,
    openGroup: 1,
    closeGroup: 3,
  },
];

// ---------------------------------------------------------------------------
// Build decorations
// ---------------------------------------------------------------------------

function buildDecorations(view: EditorView): DecorationSet {
  const decos: Array<Range<Decoration>> = [];
  const hide = Decoration.replace({});

  for (const { from, to } of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(from).number;
    const endLine = view.state.doc.lineAt(to).number;

    for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
      const line = view.state.doc.line(lineNum);
      const onThisLine = cursorOnLine(view, line.from, line.to);

      // Skip all transformations if cursor is on this line
      if (onThisLine) continue;

      const text = line.text;

      // ----------------------------------------------------------------
      // Block: Heading prefix (# , ## , ### )
      // ----------------------------------------------------------------
      const headingMatch = /^(#{1,3}) /.exec(text);
      if (headingMatch) {
        // Hide "# " (including the space)
        const prefixEnd = line.from + headingMatch[0].length;
        decos.push(hide.range(line.from, prefixEnd));
        // Headings don't have inline syntax mixed (usually), skip inline scan
        continue;
      }

      // ----------------------------------------------------------------
      // Block: Bullet list (- item) — but NOT checklists (- [ ] / - [x] )
      // ----------------------------------------------------------------
      const bulletMatch = /^(\s*)(- )(?!\[[ xX]\] )/.exec(text);
      if (bulletMatch) {
        const markerFrom = line.from + bulletMatch[1].length;
        const markerTo = markerFrom + 2; // "- "
        decos.push(hide.range(markerFrom, markerTo));
        // Still scan inline patterns in the rest of the line (fall through)
      }

      // ----------------------------------------------------------------
      // Block: Numbered list (1. item)
      // ----------------------------------------------------------------
      const numberedMatch = /^(\s*)(\d+\. )/.exec(text);
      if (numberedMatch) {
        const markerFrom = line.from + numberedMatch[1].length;
        const markerTo = markerFrom + numberedMatch[2].length;
        decos.push(hide.range(markerFrom, markerTo));
        // Fall through to inline scan
      }

      // ----------------------------------------------------------------
      // Inline: bold, italic, strikethrough, code
      // ----------------------------------------------------------------
      for (const { re, openGroup, closeGroup } of INLINE_PATTERNS) {
        re.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = re.exec(text)) !== null) {
          // Compute absolute positions
          const matchStart = line.from + match.index;

          // Open marker
          let pos = matchStart;
          for (let g = 1; g < openGroup; g++) pos += match[g]?.length ?? 0;
          const openFrom = pos;
          const openTo = openFrom + match[openGroup].length;

          // Close marker
          let cpos = matchStart;
          for (let g = 1; g < closeGroup; g++) cpos += match[g]?.length ?? 0;
          const closeFrom = cpos;
          const closeTo = closeFrom + match[closeGroup].length;

          // Skip if any decoration range already covers these positions
          // (prevents overlap errors with other patterns)
          decos.push(hide.range(openFrom, openTo));
          decos.push(hide.range(closeFrom, closeTo));
        }
      }

      // ----------------------------------------------------------------
      // Inline: Links [text](url) — hide the (url) part, keep [text]
      // Also hide the [ ] brackets around the text
      // ----------------------------------------------------------------
      const linkRe = /(\[)([^\]]+)(\]\()([^)\n]+)(\))/g;
      linkRe.lastIndex = 0;
      let linkMatch: RegExpExecArray | null;
      while ((linkMatch = linkRe.exec(text)) !== null) {
        const base = line.from + linkMatch.index;
        // Hide opening [
        const openBracketFrom = base;
        const openBracketTo = openBracketFrom + 1;
        // Hide ]( ... )  — from the ] to end of )
        const closeBracketFrom = base + 1 + linkMatch[2].length; // after [text
        const closeBracketTo = closeBracketFrom + 1 + 1 + linkMatch[4].length + 1; // ](url)
        decos.push(hide.range(openBracketFrom, openBracketTo));
        decos.push(hide.range(closeBracketFrom, closeBracketTo));
      }
    }
  }

  // Sort decorations by from position and deduplicate overlaps
  decos.sort((a, b) => a.from - b.from || a.to - b.to);

  // Remove overlapping ranges (CodeMirror throws if decorations overlap)
  const filtered: Array<Range<Decoration>> = [];
  let lastTo = -1;
  for (const d of decos) {
    if (d.from >= lastTo) {
      filtered.push(d);
      lastTo = d.to;
    }
  }

  return Decoration.set(filtered, true);
}

// ---------------------------------------------------------------------------
// ViewPlugin
// ---------------------------------------------------------------------------

export const wysiwygPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
