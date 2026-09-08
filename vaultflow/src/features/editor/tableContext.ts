/**
 * Locate the enclosing GFM table block at a document position via the
 * lezer/markdown syntax tree, then parse it into a ParsedTable and compute
 * the cursor's (row, col) inside it.
 */

import type { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import {
  looksLikeTable,
  parseTable,
  type ParsedTable,
} from "../../lib/mdTable";

export interface TableContext {
  /** Absolute doc positions of the table block. */
  from: number;
  to: number;
  /** Parsed table. */
  table: ParsedTable;
  /**
   * Row index the cursor is on: 0 = header, 1 = delimiter, 2+ = data row 0+.
   * When on a data row, `dataRow` is the row index inside table.rows.
   */
  line: number;
  dataRow: number | null;
  onHeader: boolean;
  onDelimiter: boolean;
  /** 0-based column index of the cursor (which cell inside its row). */
  col: number;
}

function findEnclosingTable(
  state: EditorState,
  pos: number,
): { from: number; to: number } | null {
  const tree = syntaxTree(state);
  const cursor = tree.cursorAt(pos, 1);
  // Walk up; if we hit a code region first, this isn't a table context.
  while (cursor) {
    const n = cursor.name;
    if (n === "FencedCode" || n === "CodeBlock" || n === "InlineCode") {
      return null;
    }
    if (n === "Table") {
      return { from: cursor.from, to: cursor.to };
    }
    if (!cursor.parent()) break;
  }
  return null;
}

/**
 * Fallback: sniff a table block around `pos` by walking outward from the
 * current line while lines still match a table row shape. Only used if the
 * lezer parser didn't produce a Table node (grammar edge case, mid-typing).
 */
function findTableByShape(
  state: EditorState,
  pos: number,
): { from: number; to: number } | null {
  // Do not sniff shape inside code regions — pipes in code (e.g. `if (a | b)`)
  // would otherwise get misidentified as a table row and swallow Enter/Tab.
  const tree = syntaxTree(state);
  const inCode = (): boolean => {
    const c = tree.cursorAt(pos, 1);
    while (c) {
      if (
        c.name === "FencedCode" ||
        c.name === "CodeBlock" ||
        c.name === "InlineCode"
      ) {
        return true;
      }
      if (!c.parent()) break;
    }
    return false;
  };
  if (inCode()) return null;

  const cursorLine = state.doc.lineAt(pos);
  const isRowShape = (n: number): boolean => {
    if (n < 1 || n > state.doc.lines) return false;
    const t = state.doc.line(n).text;
    return /\|/.test(t) || /^\s*:?-{3,}:?/.test(t);
  };
  if (!isRowShape(cursorLine.number)) return null;
  let start = cursorLine.number;
  while (start > 1 && isRowShape(start - 1)) start--;
  let end = cursorLine.number;
  while (end < state.doc.lines && isRowShape(end + 1)) end++;
  const from = state.doc.line(start).from;
  const to = state.doc.line(end).to;
  if (!looksLikeTable(state.sliceDoc(from, to))) return null;
  return { from, to };
}

export function getTableContext(
  state: EditorState,
  pos: number,
): TableContext | null {
  const range = findEnclosingTable(state, pos) ?? findTableByShape(state, pos);
  if (!range) return null;

  const text = state.sliceDoc(range.from, range.to);
  const table = parseTable(text);
  if (!table) return null;

  // Row index (0-based) within the table block.
  const startLineNo = state.doc.lineAt(range.from).number;
  const cursorLineNo = state.doc.lineAt(pos).number;
  const line = cursorLineNo - startLineNo;

  // Column index: count `|` chars before pos on the current line (edge pipes ignored).
  const lineObj = state.doc.line(cursorLineNo);
  const before = lineObj.text.slice(0, pos - lineObj.from);
  const bar = /\|/g;
  let barsBefore = 0;
  while (bar.exec(before)) barsBefore++;
  // If the line starts with '|', the first '|' is an edge pipe, not a separator.
  const leadingPipe = lineObj.text.startsWith("|");
  const col = Math.max(
    0,
    Math.min(table.alignments.length - 1, leadingPipe ? barsBefore - 1 : barsBefore),
  );

  const onHeader = line === 0;
  const onDelimiter = line === 1;
  const dataRow = onHeader || onDelimiter ? null : line - 2;
  return { ...range, table, line, dataRow, onHeader, onDelimiter, col };
}
