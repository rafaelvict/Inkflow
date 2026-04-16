/**
 * Editor preferences — font family and font size.
 * Persisted in localStorage so they survive app restarts.
 */
import { useState, useCallback } from "react";

const STORAGE_KEY = "inkflow:editorPrefs";

export interface EditorPrefs {
  fontFamily: string;
  fontSize: number; // px
}

export const FONT_OPTIONS = [
  { label: "Segoe UI", value: "Segoe UI Variable, Segoe UI, system-ui, sans-serif" },
  { label: "Calibri", value: "Calibri, Candara, Segoe, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Consolas", value: "Consolas, 'Courier New', monospace" },
  { label: "Cascadia Code", value: "'Cascadia Code', Consolas, monospace" },
] as const;

const DEFAULTS: EditorPrefs = {
  fontFamily: FONT_OPTIONS[0].value,
  fontSize: 14,
};

const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 24;
const FONT_SIZE_STEP = 1;

function loadPrefs(): EditorPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function savePrefs(prefs: EditorPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // storage might be unavailable in some contexts
  }
}

export function useEditorPrefs() {
  const [prefs, setPrefsState] = useState<EditorPrefs>(loadPrefs);

  const setPrefs = useCallback((patch: Partial<EditorPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const increaseFontSize = useCallback(() => {
    setPrefsState((prev) => {
      const next = { ...prev, fontSize: Math.min(prev.fontSize + FONT_SIZE_STEP, FONT_SIZE_MAX) };
      savePrefs(next);
      return next;
    });
  }, []);

  const decreaseFontSize = useCallback(() => {
    setPrefsState((prev) => {
      const next = { ...prev, fontSize: Math.max(prev.fontSize - FONT_SIZE_STEP, FONT_SIZE_MIN) };
      savePrefs(next);
      return next;
    });
  }, []);

  return { prefs, setPrefs, increaseFontSize, decreaseFontSize };
}
