/**
 * Data model for "sheet" notes: a spreadsheet with editable rows/columns plus
 * optional chart views built from column data. Persisted as JSON in the
 * note's `content` field so it round-trips through the existing StorageAdapter.
 */

export type ChartType = "bar" | "line" | "area" | "pie";

export interface SheetColumn {
  key: string;
  name: string;
  width?: number;
}

export type SheetCell = string | number | null;
export interface SheetRow {
  id: string;
  [key: string]: SheetCell | string; // id is always string; cells vary
}

export interface SheetChart {
  id: string;
  type: ChartType;
  title: string;
  xKey: string;
  yKeys: string[];
}

export interface SheetData {
  columns: SheetColumn[];
  rows: SheetRow[];
  charts: SheetChart[];
}

const uid = () => crypto.randomUUID();

export function emptySheet(): SheetData {
  return {
    columns: [
      { key: "col1", name: "A" },
      { key: "col2", name: "B" },
      { key: "col3", name: "C" },
    ],
    rows: [
      { id: uid(), col1: "", col2: "", col3: "" },
      { id: uid(), col1: "", col2: "", col3: "" },
      { id: uid(), col1: "", col2: "", col3: "" },
    ],
    charts: [],
  };
}

export function parseSheet(content: string): SheetData {
  if (!content) return emptySheet();
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object") {
      const p = parsed as Partial<SheetData>;
      if (Array.isArray(p.columns) && Array.isArray(p.rows)) {
        return {
          columns: p.columns,
          rows: p.rows,
          charts: Array.isArray(p.charts) ? p.charts : [],
        };
      }
    }
  } catch {
    /* corrupt — fall back */
  }
  return emptySheet();
}

export function serializeSheet(data: SheetData): string {
  return JSON.stringify(data);
}

// -- mutations (return new SheetData) --------------------------------------

export function addRowAt(data: SheetData, at: number): SheetData {
  const blank: SheetRow = { id: uid() };
  for (const c of data.columns) blank[c.key] = "";
  const rows = [...data.rows.slice(0, at), blank, ...data.rows.slice(at)];
  return { ...data, rows };
}

export function deleteRow(data: SheetData, at: number): SheetData {
  const rows = data.rows.filter((_, i) => i !== at);
  return { ...data, rows };
}

function uniqueKey(data: SheetData): string {
  let n = data.columns.length + 1;
  while (data.columns.some((c) => c.key === `col${n}`)) n++;
  return `col${n}`;
}

function nextColumnName(data: SheetData): string {
  // A, B, C ... Z, AA, AB ...
  const n = data.columns.length;
  let s = "";
  let x = n;
  do {
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26) - 1;
  } while (x >= 0);
  return s;
}

export function addColumnAt(data: SheetData, at: number): SheetData {
  const key = uniqueKey(data);
  const name = nextColumnName(data);
  const columns = [
    ...data.columns.slice(0, at),
    { key, name },
    ...data.columns.slice(at),
  ];
  const rows = data.rows.map((r) => ({ ...r, [key]: "" }));
  return { ...data, columns, rows };
}

export function deleteColumn(data: SheetData, at: number): SheetData {
  if (data.columns.length <= 1) return data;
  const removed = data.columns[at];
  const columns = data.columns.filter((_, i) => i !== at);
  const rows = data.rows.map((r) => {
    const copy: SheetRow = { id: String(r.id) };
    for (const c of columns) copy[c.key] = r[c.key] ?? "";
    return copy;
  });
  // Also drop the removed key from any chart yKeys / xKey.
  const charts = data.charts
    .map((c) => ({
      ...c,
      xKey: c.xKey === removed.key ? "" : c.xKey,
      yKeys: c.yKeys.filter((k) => k !== removed.key),
    }))
    .filter((c) => c.xKey && c.yKeys.length > 0);
  return { columns, rows, charts };
}

export function renameColumn(
  data: SheetData,
  at: number,
  newName: string,
): SheetData {
  const columns = data.columns.map((c, i) =>
    i === at ? { ...c, name: newName } : c,
  );
  return { ...data, columns };
}

export function setCell(
  data: SheetData,
  rowId: string,
  columnKey: string,
  value: SheetCell,
): SheetData {
  const rows = data.rows.map((r) =>
    r.id === rowId ? { ...r, [columnKey]: value } : r,
  );
  return { ...data, rows };
}

export function addChart(data: SheetData, chart: Omit<SheetChart, "id">): SheetData {
  return {
    ...data,
    charts: [...data.charts, { id: uid(), ...chart }],
  };
}

export function updateChart(
  data: SheetData,
  id: string,
  patch: Partial<SheetChart>,
): SheetData {
  return {
    ...data,
    charts: data.charts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

export function deleteChart(data: SheetData, id: string): SheetData {
  return { ...data, charts: data.charts.filter((c) => c.id !== id) };
}

// -- projection for charts --------------------------------------------------

/** Convert cell to number for chart plotting; empty / non-numeric → null. */
export function toNumber(value: SheetCell | string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
