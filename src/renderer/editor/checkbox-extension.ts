/**
 * CodeMirror extension: interactive markdown checkboxes.
 *
 * Replaces `- [ ] ` and `- [x] ` visually with a clickable checkbox.
 * The underlying markdown text is preserved — clicking toggles between [ ] and [x].
 * The replacement decoration hides the `- [ ] ` prefix so the user can't accidentally
 * edit inside the brackets.
 */
import {
  EditorView,
  Decoration,
  WidgetType,
  ViewPlugin,
  type ViewUpdate,
  type DecorationSet,
} from "@codemirror/view";

// Matches: optional whitespace, then `- [ ] ` or `- [x] ` or `- [X] `
// Group 1: leading whitespace + `- [`
// Group 2: the check character (space, x, X)
// Group 3: `] ` (closing bracket + space)
const TASK_RE = /^(\s*- \[)([ xX])(\] )/;

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    /** Position of the character inside [ ] — either " " or "x" */
    readonly togglePos: number,
  ) {
    super();
  }

  eq(other: CheckboxWidget) {
    return this.checked === other.checked && this.togglePos === other.togglePos;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cm-task-check-wrap";

    const bullet = document.createElement("span");
    bullet.className = "cm-task-bullet";
    bullet.textContent = "•";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.className = "cm-task-checkbox";
    input.setAttribute("aria-label", this.checked ? "Concluído" : "Pendente");

    input.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const newChar = this.checked ? " " : "x";
      view.dispatch({
        changes: {
          from: this.togglePos,
          to: this.togglePos + 1,
          insert: newChar,
        },
      });
    });

    wrap.appendChild(bullet);
    wrap.appendChild(input);
    return wrap;
  }

  ignoreEvent() {
    return false;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const decorations: any[] = [];

  for (const { from, to } of view.visibleRanges) {
    const startLine = view.state.doc.lineAt(from).number;
    const endLine = view.state.doc.lineAt(to).number;

    for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
      const line = view.state.doc.line(lineNum);
      const match = TASK_RE.exec(line.text);
      if (!match) continue;

      const checked = match[2] === "x" || match[2] === "X";
      const togglePos = line.from + match[1].length; // position of " " or "x"

      // Replace the entire `- [ ] ` prefix with the checkbox widget
      const replaceFrom = line.from;
      const replaceTo = line.from + match[0].length;

      // Don't replace if cursor is inside the replaced range — let user edit raw
      const cursorInRange = view.state.selection.ranges.some(
        (r) => r.from >= replaceFrom && r.from <= replaceTo,
      );

      if (cursorInRange) continue;

      const deco = Decoration.replace({
        widget: new CheckboxWidget(checked, togglePos),
      });

      decorations.push(deco.range(replaceFrom, replaceTo));
    }
  }

  return Decoration.set(decorations, true);
}

export const checkboxPlugin = ViewPlugin.fromClass(
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

/** Styles for checkbox widget */
export const checkboxTheme = EditorView.baseTheme({
  ".cm-task-check-wrap": {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    marginRight: "2px",
  },
  ".cm-task-bullet": {
    display: "none", // Hidden — we show the checkbox instead of the bullet
  },
  ".cm-task-checkbox": {
    cursor: "pointer",
    width: "15px",
    height: "15px",
    verticalAlign: "middle",
    position: "relative",
    top: "-1px",
    accentColor: "var(--accent, #005fb8)",
    margin: "0",
    flexShrink: "0",
  },
});
