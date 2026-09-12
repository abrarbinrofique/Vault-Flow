import { emptyTable, serializeTable } from "../../lib/mdTable";
import { emptySheet, serializeSheet } from "../sheet/sheetModel";
import { getFocusedEditor } from "./focusedEditor";

/**
 * Insert an inline Excel-style spreadsheet block (```sheet fenced code) at
 * the current selection in the focused editor.
 */
export function insertSheetAtCursor(): boolean {
  const view = getFocusedEditor();
  if (!view) return false;
  const payload = serializeSheet(emptySheet());
  const sel = view.state.selection.main;
  const line = view.state.doc.lineAt(sel.from);
  const needsLeadingBlank = line.from !== sel.from || line.text.trim().length > 0;
  const block = "```sheet\n" + payload + "\n```\n";
  const insertText = (needsLeadingBlank ? "\n\n" : "") + block;
  const from = needsLeadingBlank ? sel.from : line.from;
  view.dispatch({
    changes: { from, to: sel.to, insert: insertText },
    // Place cursor after the block (widget will replace the block itself).
    selection: { anchor: from + insertText.length },
  });
  view.focus();
  return true;
}

/**
 * Insert a plain 2×2 GFM markdown table at the current selection. Kept
 * available for users who specifically want the classic pipe-table syntax
 * (e.g. maximum export portability).
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
