/**
 * Pure helpers to parse and manipulate GFM markdown tables as text. All
 * operations operate on the raw table block; callers dispatch the resulting
 * text via CodeMirror. No React / DOM here so this can be unit tested and
 * shared across the editor + toolbar + keymap.
 */

export type Align = "none" | "left" | "center" | "right";

export interface ParsedTable {
  /** Header row cells (trimmed). */
  header: string[];
  /** Data rows (each an array of trimmed cell strings). */
  rows: string[][];
  /** Column alignments derived from the delimiter row. */
  alignments: Align[];
}

const DELIM_LINE = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/;
const CELL_ROW_HINT = /\|/;

function stripEdgePipes(line: string): string {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s;
}

function splitCells(line: string): string[] {
  return stripEdgePipes(line)
    .split("|")
    .map((c) => c.trim());
}

function parseAlignment(cell: string): Align {
  const c = cell.trim();
  const left = c.startsWith(":");
  const right = c.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return "none";
}

/** Returns true if the given block of text looks like a GFM table. */
export function looksLikeTable(text: string): boolean {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return false;
  return CELL_ROW_HINT.test(lines[0]) && DELIM_LINE.test(lines[1]);
}

/** Parse the raw markdown of a table block. */
export function parseTable(text: string): ParsedTable | null {
  const rawLines = text.split("\n");
  // Trim trailing empty lines (block may end at start of next paragraph).
  while (rawLines.length && !rawLines[rawLines.length - 1].trim()) rawLines.pop();
  if (rawLines.length < 2) return null;
  if (!DELIM_LINE.test(rawLines[1])) return null;

  const header = splitCells(rawLines[0]);
  const alignments = splitCells(rawLines[1]).map(parseAlignment);
  const rows: string[][] = [];
  for (let i = 2; i < rawLines.length; i++) {
    if (!rawLines[i].trim()) break;
    rows.push(splitCells(rawLines[i]));
  }

  const cols = Math.max(header.length, ...rows.map((r) => r.length), alignments.length);
  const pad = <T,>(arr: T[], fill: T): T[] =>
    arr.length >= cols ? arr.slice(0, cols) : [...arr, ...Array<T>(cols - arr.length).fill(fill)];
  return {
    header: pad(header, ""),
    rows: rows.map((r) => pad(r, "")),
    alignments: pad(alignments, "none"),
  };
}

function delimCell(a: Align): string {
  switch (a) {
    case "left":
      return ":---";
    case "center":
      return ":---:";
    case "right":
      return "---:";
    default:
      return "---";
  }
}

export function serializeTable(t: ParsedTable): string {
  const rowLine = (cells: string[]) =>
    `| ${cells.map((c) => c || " ").join(" | ")} |`;
  const delim = `| ${t.alignments.map(delimCell).join(" | ")} |`;
  const lines = [rowLine(t.header), delim, ...t.rows.map(rowLine)];
  return lines.join("\n");
}

/** Blank table with the given rows / cols (rows excludes header). */
export function emptyTable(cols = 2, rows = 2): ParsedTable {
  const header = Array.from({ length: cols }, (_, i) => `Col ${i + 1}`);
  const alignments: Align[] = Array<Align>(cols).fill("none");
  const dataRows = Array.from({ length: rows }, () =>
    Array<string>(cols).fill(""),
  );
  return { header, alignments, rows: dataRows };
}

// -- Mutations (return new tables) -----------------------------------------

export function addRow(t: ParsedTable, at: number): ParsedTable {
  const clamped = Math.max(0, Math.min(t.rows.length, at));
  const blank = Array<string>(t.alignments.length).fill("");
  const rows = [...t.rows.slice(0, clamped), blank, ...t.rows.slice(clamped)];
  return { ...t, rows };
}

export function deleteRow(t: ParsedTable, at: number): ParsedTable {
  if (t.rows.length === 0) return t;
  const clamped = Math.max(0, Math.min(t.rows.length - 1, at));
  const rows = [...t.rows.slice(0, clamped), ...t.rows.slice(clamped + 1)];
  return { ...t, rows };
}

export function addColumn(t: ParsedTable, at: number): ParsedTable {
  const clamped = Math.max(0, Math.min(t.alignments.length, at));
  const insertInto = <T,>(arr: T[], v: T) => [
    ...arr.slice(0, clamped),
    v,
    ...arr.slice(clamped),
  ];
  return {
    header: insertInto(t.header, ""),
    alignments: insertInto(t.alignments, "none"),
    rows: t.rows.map((r) => insertInto(r, "")),
  };
}

export function deleteColumn(t: ParsedTable, at: number): ParsedTable {
  if (t.alignments.length <= 1) return t;
  const drop = <T,>(arr: T[]) => [
    ...arr.slice(0, at),
    ...arr.slice(at + 1),
  ];
  return {
    header: drop(t.header),
    alignments: drop(t.alignments),
    rows: t.rows.map(drop),
  };
}

export function setAlignment(t: ParsedTable, col: number, a: Align): ParsedTable {
  if (col < 0 || col >= t.alignments.length) return t;
  const alignments = [...t.alignments];
  alignments[col] = a;
  return { ...t, alignments };
}
