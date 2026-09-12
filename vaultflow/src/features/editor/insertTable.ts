import type { EditorView } from "@codemirror/view";
import { emptyTable, serializeTable } from "../../lib/mdTable";
import { emptySheet, serializeSheet } from "../sheet/sheetModel";
import { useVaultStore } from "../../stores/useVaultStore";
import { allEditors, getFocusedEditor } from "./focusedEditor";

async function withEditor(fn: (view: EditorView) => void): Promise<boolean> {
  // Try focused first, fall back to any mounted editor.
  let view = getFocusedEditor() ?? allEditors()[0] ?? null;
  if (!view) {
    // No editor mounted — the user is on EmptyState or a drawing/sheet note.
    // Create a fresh markdown note so the command still lands somewhere.
    const active = useVaultStore.getState().activeNoteId;
    const focusedNote = active ? useVaultStore.getState().notes[active] : null;
    if (!focusedNote || focusedNote.kind !== "markdown") {
      await useVaultStore
        .getState()
        .createNote({ title: "Untitled", path: "" });
    }
    // Wait a tick for the Editor to mount and register itself.
    await new Promise((r) => setTimeout(r, 30));
    view = getFocusedEditor() ?? allEditors()[0] ?? null;
    if (!view) return false;
  }
  const localView = view;
  // Defer dispatch so the command palette can close first and focus can land
  // in the editor before we insert / move the cursor.
  setTimeout(() => {
    localView.focus();
    fn(localView);
  }, 0);
  return true;
}

/**
 * Insert an inline Excel-style spreadsheet block (```sheet fenced code) at
 * the current selection in the focused editor.
 */
export async function insertSheetAtCursor(): Promise<boolean> {
  return withEditor((view) => {
    const payload = serializeSheet(emptySheet());
    const sel = view.state.selection.main;
    const line = view.state.doc.lineAt(sel.from);
    const needsLeadingBlank =
      line.from !== sel.from || line.text.trim().length > 0;
    const block = "```sheet\n" + payload + "\n```\n";
    const insertText = (needsLeadingBlank ? "\n\n" : "") + block;
    const from = needsLeadingBlank ? sel.from : line.from;
    view.dispatch({
      changes: { from, to: sel.to, insert: insertText },
      selection: { anchor: from + insertText.length },
    });
    view.focus();
  });
}

/**
 * Insert a plain 2×2 GFM markdown table at the current selection.
 */
export async function insertTableAtCursor(): Promise<boolean> {
  return withEditor((view) => {
    const table = serializeTable(emptyTable());
    const sel = view.state.selection.main;
    const line = view.state.doc.lineAt(sel.from);
    const needsLeadingBlank =
      line.from !== sel.from || line.text.trim().length > 0;
    const insertText = (needsLeadingBlank ? "\n\n" : "") + table + "\n";
    const from = needsLeadingBlank ? sel.from : line.from;
    view.dispatch({
      changes: { from, to: sel.to, insert: insertText },
      selection: { anchor: from + insertText.length - table.length + 2 },
    });
    view.focus();
  });
}
