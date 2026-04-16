/**
 * Text Style Extension for CodeMirror 6.
 *
 * Applies font-size and font-family decorations to explicit ranges without
 * modifying the document content. Styles are ephemeral — they live for the
 * current editor session and do not persist to disk.
 *
 * Ranges are stored in a StateField and updated via StateEffects:
 *   - addStyleEffect   — add a style to the current selection
 *   - clearStyleEffect — remove all styles (reset)
 *
 * Document changes (insertions, deletions) automatically remap stored ranges
 * via the ChangeDesc.mapPos API so decorations track the text they cover.
 */

import {
  StateField,
  StateEffect,
  type Transaction,
  type ChangeDesc,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  type DecorationSet,
} from "@codemirror/view";
import type { Range } from "@codemirror/state";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TextStyleRange {
  from: number;
  to: number;
  fontSize?: number; // px
  fontFamily?: string;
}

// ---------------------------------------------------------------------------
// StateEffects
// ---------------------------------------------------------------------------

/** Add a styled range. Only processes if from < to. */
export const addStyleEffect = StateEffect.define<TextStyleRange>();

/** Remove all ephemeral style ranges. */
export const clearStyleEffect = StateEffect.define<void>();

// ---------------------------------------------------------------------------
// Build a single Decoration.mark for a style range
// ---------------------------------------------------------------------------

function buildDeco(range: TextStyleRange): Range<Decoration> {
  const parts: string[] = [];
  if (range.fontSize != null) parts.push(`font-size: ${range.fontSize}px`);
  if (range.fontFamily) parts.push(`font-family: ${range.fontFamily}`);

  return Decoration.mark({
    attributes: { style: parts.join("; ") },
    class: "cm-text-style",
  }).range(range.from, range.to);
}

// ---------------------------------------------------------------------------
// Remap stored ranges after a document change
// ---------------------------------------------------------------------------

function remapRanges(
  ranges: TextStyleRange[],
  changes: ChangeDesc,
): TextStyleRange[] {
  return ranges
    .map((r) => {
      const from = changes.mapPos(r.from, 1);
      const to = changes.mapPos(r.to, -1);
      if (from >= to) return null; // range collapsed — drop it
      return { ...r, from, to };
    })
    .filter((r): r is TextStyleRange => r !== null);
}

// ---------------------------------------------------------------------------
// StateField
// ---------------------------------------------------------------------------

interface StyleState {
  ranges: TextStyleRange[];
  decos: DecorationSet;
}

function buildDecoSet(ranges: TextStyleRange[]): DecorationSet {
  if (ranges.length === 0) return Decoration.none;

  // Sort by from, then to — required by Decoration.set
  const sorted = [...ranges].sort((a, b) => a.from - b.from || a.to - b.to);

  // Merge overlapping ranges that share the same style values
  const merged: TextStyleRange[] = [];
  for (const r of sorted) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      r.from <= prev.to &&
      r.fontSize === prev.fontSize &&
      r.fontFamily === prev.fontFamily
    ) {
      prev.to = Math.max(prev.to, r.to);
    } else {
      merged.push({ ...r });
    }
  }

  const decos: Range<Decoration>[] = merged
    .filter((r) => r.from < r.to)
    .map(buildDeco);

  return decos.length > 0 ? Decoration.set(decos, true) : Decoration.none;
}

export const textStyleField = StateField.define<StyleState>({
  create() {
    return { ranges: [], decos: Decoration.none };
  },

  update(state: StyleState, tr: Transaction): StyleState {
    let { ranges } = state;
    let changed = false;

    // Remap existing ranges when the document changes
    if (tr.docChanged) {
      ranges = remapRanges(ranges, tr.changes);
      changed = true;
    }

    // Process effects
    for (const effect of tr.effects) {
      if (effect.is(clearStyleEffect)) {
        ranges = [];
        changed = true;
      } else if (effect.is(addStyleEffect)) {
        const val = effect.value as TextStyleRange;
        if (val.from < val.to) {
          // Apply new style on top of existing ones for this range:
          // Split any existing ranges that overlap, then add the new one.
          ranges = applyStyle(ranges, val);
          changed = true;
        }
      }
    }

    if (!changed) return state;

    const decos = buildDecoSet(ranges);
    return { ranges, decos };
  },

  provide: (f) => EditorView.decorations.from(f, (s) => s.decos),
});

// ---------------------------------------------------------------------------
// Apply a style over a range, splitting existing ranges at boundaries
// ---------------------------------------------------------------------------

function applyStyle(
  existing: TextStyleRange[],
  next: TextStyleRange,
): TextStyleRange[] {
  const result: TextStyleRange[] = [];

  for (const r of existing) {
    // No overlap — keep as-is
    if (r.to <= next.from || r.from >= next.to) {
      result.push(r);
      continue;
    }

    // Left fragment (before the new range)
    if (r.from < next.from) {
      result.push({ ...r, to: next.from });
    }

    // Right fragment (after the new range)
    if (r.to > next.to) {
      result.push({ ...r, from: next.to });
    }

    // Overlapping segment: merge style values
    const overlapFrom = Math.max(r.from, next.from);
    const overlapTo = Math.min(r.to, next.to);
    result.push({
      from: overlapFrom,
      to: overlapTo,
      fontSize: next.fontSize ?? r.fontSize,
      fontFamily: next.fontFamily ?? r.fontFamily,
    });
  }

  // Add the new range for parts not already covered
  const covered = result.filter(
    (r) => r.from >= next.from && r.to <= next.to,
  );
  if (covered.length === 0) {
    result.push({ ...next });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public helpers — called from FormatToolbar / App
// ---------------------------------------------------------------------------

/**
 * Apply a font-size change to the current selection ranges in the editor.
 * If nothing is selected, does nothing (caller decides the fallback).
 * Returns true if any ranges were styled.
 */
export function applyFontSizeToSelection(
  view: EditorView,
  fontSize: number,
): boolean {
  const effects: StateEffect<TextStyleRange>[] = [];

  for (const range of view.state.selection.ranges) {
    if (range.from === range.to) continue; // cursor only, skip
    effects.push(
      addStyleEffect.of({ from: range.from, to: range.to, fontSize }),
    );
  }

  if (effects.length === 0) return false;

  view.dispatch({ effects });
  return true;
}

/**
 * Apply a font-family change to the current selection ranges in the editor.
 * Returns true if any ranges were styled.
 */
export function applyFontFamilyToSelection(
  view: EditorView,
  fontFamily: string,
): boolean {
  const effects: StateEffect<TextStyleRange>[] = [];

  for (const range of view.state.selection.ranges) {
    if (range.from === range.to) continue;
    effects.push(
      addStyleEffect.of({ from: range.from, to: range.to, fontFamily }),
    );
  }

  if (effects.length === 0) return false;

  view.dispatch({ effects });
  return true;
}

/**
 * Returns true if the editor currently has a non-empty text selection.
 */
export function hasTextSelection(view: EditorView): boolean {
  return view.state.selection.ranges.some((r) => r.from !== r.to);
}
