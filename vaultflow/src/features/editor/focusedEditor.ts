/**
 * Small registry so palette commands and hotkeys can reach the CodeMirror
 * EditorView that currently has focus (there can be two of them at once when
 * the split pane is open).
 */

import type { EditorView } from "@codemirror/view";

const views = new Set<EditorView>();

export function registerEditor(view: EditorView): void {
  views.add(view);
}

export function unregisterEditor(view: EditorView): void {
  views.delete(view);
}

export function getFocusedEditor(): EditorView | null {
  for (const v of views) {
    if (v.hasFocus) return v;
  }
  // Fallback to the first one so palette actions still work if focus is elsewhere.
  const first = views.values().next().value;
  return first ?? null;
}

export function allEditors(): EditorView[] {
  return [...views];
}
