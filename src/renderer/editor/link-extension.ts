/**
 * CodeMirror extension: clickable links.
 *
 * Ctrl+Click on a URL in the editor opens it in the default browser
 * via Electron's shell.openExternal (through the preload bridge).
 */
import { EditorView } from "@codemirror/view";

/** 
 * URL regex: matches http(s) URLs in text.
 * Used for Ctrl+Click detection.
 */
const URL_RE = /https?:\/\/[^\s<>)"'\]]+/g;

/**
 * Extension that opens URLs on Ctrl+Click.
 * We use a DOM event handler rather than a decoration because
 * we only need to detect clicks, not render anything.
 */
export const clickableLinks = EditorView.domEventHandlers({
  click(event: MouseEvent, view: EditorView) {
    if (!event.ctrlKey && !event.metaKey) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    // Get the line at click position
    const line = view.state.doc.lineAt(pos);
    const lineText = line.text;

    // Find all URLs in the line and check if click is within one
    let match;
    URL_RE.lastIndex = 0;
    while ((match = URL_RE.exec(lineText)) !== null) {
      const urlStart = line.from + match.index;
      const urlEnd = urlStart + match[0].length;

      if (pos >= urlStart && pos <= urlEnd) {
        event.preventDefault();
        const url = match[0];
        
        // Open in default browser via Electron shell
        // We use window.open as a fallback — the CSP in main process
        // blocks navigation, but in dev mode this could work.
        // Better: call through electronAPI if available.
        try {
          window.electronAPI.shell.openExternal(url);
        } catch {
          // Silently fail if we can't open
        }
        return true;
      }
    }

    return false;
  },
});

/**
 * Cursor changes to pointer on Ctrl+hover over links.
 * Note: CM6 doesn't natively support per-character cursor changes,
 * so we rely on the Ctrl+click behavior being intuitive.
 */
