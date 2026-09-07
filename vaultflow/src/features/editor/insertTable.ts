import { emptyTable, serializeTable } from "../../lib/mdTable";
import { getFocusedEditor } from "./focusedEditor";

/**
 * Insert a 2×2 GFM table at the current selection in the focused editor.
 * Called from the command palette; no-op if no CodeMirror view is currently
 * focused.
 */
export function insertTableAtCursor(): boolean {
  const view = getFocusedEditor();
  if (!view) return false;

  const table = serializeTable(emptyTable());
  const sel = view.state.selection.main;
  const line = view.state.doc.lineAt(sel.from);
  const needsLeadingBlank = line.from !== sel.from || line.text.trim().length > 0;
  const insertText = (needsLeadingBlank ? "\n\n" : "") + table + "\n";
  const from = needsLeadingBlank ? sel.from : line.from;

  view.dispatch({
    changes: { from, to: sel.to, insert: insertText },
    selection: { anchor: from + insertText.length - table.length + 2 },
  });
  view.focus();
  return true;
}
