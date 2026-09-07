/**
 * Keymap for GFM tables: Tab / Shift+Tab jump between cells, Enter on the
 * last cell of the last data row appends a fresh row. Falls through to
 * default behavior when the cursor isn't in a table.
 */

import { keymap, type EditorView } from "@codemirror/view";
import { addRow, serializeTable } from "../../lib/mdTable";
import { getTableContext } from "./tableContext";

interface CellRange {
  line: number; // 1-based document line number
  from: number;
  to: number;
}

/**
 * Find all cell ranges in the table, in visual order. The cell "content" is
 * the text between the pipes (edges included stripped). Excludes the
 * delimiter row.
 */
function cellRangesForTable(
  view: EditorView,
  ctx: ReturnType<typeof getTableContext>,
): CellRange[] {
  if (!ctx) return [];
  const doc = view.state.doc;
  const startLineNo = doc.lineAt(ctx.from).number;
  const endLineNo = doc.lineAt(ctx.to).number;
  const ranges: CellRange[] = [];
  for (let n = startLineNo; n <= endLineNo; n++) {
    const rel = n - startLineNo;
    if (rel === 1) continue; // delimiter
    const line = doc.line(n);
    // Split at each `|`, tracking positions
    const text = line.text;
    // Determine cell starts + ends between pipes. Trim inside the split.
    const positions: { start: number; end: number }[] = [];
    const bars: number[] = [];
    for (let i = 0; i < text.length; i++) if (text[i] === "|") bars.push(i);
    if (bars.length === 0) continue;
    const leading = text.startsWith("|");
    for (let i = 0; i < bars.length - 1; i++) {
      const cellStart = bars[i] + 1;
      const cellEnd = bars[i + 1];
      if (i === 0 && !leading) {
        // No leading pipe: the first cell spans from line start to bars[0]
        positions.push({ start: 0, end: bars[0] });
      }
      positions.push({ start: cellStart, end: cellEnd });
    }
    // If no leading pipe and there's only one bar, we already pushed the "before first bar" cell.
    if (!leading && bars.length === 1) {
      positions.push({ start: 0, end: bars[0] });
    }
    for (const p of positions) {
      // Skip if this cell has zero width (edge pipe artifacts)
      if (p.start >= p.end && text[p.start] !== "|") continue;
      ranges.push({ line: n, from: line.from + p.start, to: line.from + p.end });
    }
  }
  return ranges;
}

function currentCellIndex(head: number, cells: CellRange[]): number {
  for (let i = 0; i < cells.length; i++) {
    if (head >= cells[i].from && head <= cells[i].to) return i;
  }
  // If cursor is right at a pipe, pick the following cell.
  for (let i = 0; i < cells.length; i++) {
    if (head < cells[i].from) return i;
  }
  return cells.length - 1;
}

function selectCell(view: EditorView, cell: CellRange) {
  // Place caret at the start of the cell's trimmed content; select whole content
  const text = view.state.sliceDoc(cell.from, cell.to);
  const leading = text.match(/^\s*/)![0].length;
  const trailing = text.match(/\s*$/)![0].length;
  const anchor = cell.from + leading;
  const head = cell.to - trailing;
  view.dispatch({ selection: { anchor, head } });
  view.focus();
}

function jumpToCell(view: EditorView, delta: number): boolean {
  const head = view.state.selection.main.head;
  const ctx = getTableContext(view.state, head);
  if (!ctx) return false;
  const cells = cellRangesForTable(view, ctx);
  if (cells.length === 0) return false;
  const idx = currentCellIndex(head, cells);
  const target = idx + delta;
  if (target < 0) return true; // consumed; do nothing at the start
  if (target >= cells.length) {
    if (delta > 0) {
      // Append a new row and jump into its first cell.
      const nextTable = addRow(ctx.table, ctx.table.rows.length);
      const nextText = serializeTable(nextTable);
      const oldLen = ctx.to - ctx.from;
      const newLen = nextText.length;
      view.dispatch({
        changes: { from: ctx.from, to: ctx.to, insert: nextText },
      });
      // Recompute cells for the new table and jump to the first new cell.
      const newCtx = getTableContext(
        view.state,
        // put a temporary head somewhere in the table
        ctx.from + Math.min(head - ctx.from + (newLen - oldLen), newLen - 1),
      );
      if (newCtx) {
        const newCells = cellRangesForTable(view, newCtx);
        if (newCells[idx + 1]) selectCell(view, newCells[idx + 1]);
      }
      return true;
    }
    return true;
  }
  selectCell(view, cells[target]);
  return true;
}

function enterInTable(view: EditorView): boolean {
  const head = view.state.selection.main.head;
  const ctx = getTableContext(view.state, head);
  if (!ctx) return false;
  const cells = cellRangesForTable(view, ctx);
  if (cells.length === 0) return false;
  const idx = currentCellIndex(head, cells);
  // Only add a new row when we're on the last cell of the last data row.
  const cols = ctx.table.alignments.length;
  const isLastCell = idx === cells.length - 1;
  if (!isLastCell) return false;
  // Add a data row and jump into its first cell.
  const nextTable = addRow(ctx.table, ctx.table.rows.length);
  const nextText = serializeTable(nextTable);
  view.dispatch({ changes: { from: ctx.from, to: ctx.to, insert: nextText } });
  const newCtx = getTableContext(view.state, ctx.from);
  if (newCtx) {
    const newCells = cellRangesForTable(view, newCtx);
    // The first cell of the newly added row = last row * cols + 0 (data cells)
    // Header takes `cols` cells, so first cell of last row = (rowsCount) * cols
    const firstOfNew = cells.length; // one more row of `cols` cells was appended
    if (newCells[firstOfNew]) selectCell(view, newCells[firstOfNew]);
    else if (newCells[newCells.length - cols]) {
      selectCell(view, newCells[newCells.length - cols]);
    }
  }
  return true;
}

export const tableKeymap = keymap.of([
  {
    key: "Tab",
    run: (view) => jumpToCell(view, 1),
  },
  {
    key: "Shift-Tab",
    run: (view) => jumpToCell(view, -1),
  },
  {
    key: "Enter",
    run: (view) => enterInTable(view),
  },
]);
