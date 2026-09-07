import { describe, expect, it } from "vitest";
import {
  addColumn,
  addRow,
  deleteColumn,
  deleteRow,
  emptyTable,
  looksLikeTable,
  parseTable,
  serializeTable,
  setAlignment,
} from "./mdTable";

const T = `| A | B | C |
| --- | :---: | ---: |
| 1 | 2 | 3 |
| 4 | 5 | 6 |`;

describe("looksLikeTable", () => {
  it("matches a simple GFM table", () => {
    expect(looksLikeTable(T)).toBe(true);
  });
  it("rejects normal prose", () => {
    expect(looksLikeTable("hello\nworld")).toBe(false);
  });
});

describe("parseTable / serializeTable", () => {
  it("round-trips a table with alignments", () => {
    const p = parseTable(T);
    expect(p).not.toBeNull();
    expect(p!.header).toEqual(["A", "B", "C"]);
    expect(p!.alignments).toEqual(["none", "center", "right"]);
    expect(p!.rows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
    // Serialize normalizes spacing but keeps semantic content.
    const s = serializeTable(p!);
    expect(s).toContain("| A | B | C |");
    expect(s).toContain("| --- | :---: | ---: |");
    expect(s).toContain("| 1 | 2 | 3 |");
  });

  it("pads rows shorter than header", () => {
    const p = parseTable(`| A | B | C |\n| --- | --- | --- |\n| 1 | 2 |`);
    expect(p!.rows[0]).toEqual(["1", "2", ""]);
  });
});

describe("mutations", () => {
  it("addRow inserts at index", () => {
    const p = parseTable(T)!;
    const p2 = addRow(p, 1);
    expect(p2.rows).toEqual([["1", "2", "3"], ["", "", ""], ["4", "5", "6"]]);
  });
  it("deleteRow removes at index", () => {
    const p = parseTable(T)!;
    const p2 = deleteRow(p, 0);
    expect(p2.rows).toEqual([["4", "5", "6"]]);
  });
  it("addColumn inserts a column", () => {
    const p = parseTable(T)!;
    const p2 = addColumn(p, 1);
    expect(p2.header).toEqual(["A", "", "B", "C"]);
    expect(p2.rows[0]).toEqual(["1", "", "2", "3"]);
    expect(p2.alignments).toEqual(["none", "none", "center", "right"]);
  });
  it("deleteColumn removes a column and its alignment", () => {
    const p = parseTable(T)!;
    const p2 = deleteColumn(p, 1);
    expect(p2.header).toEqual(["A", "C"]);
    expect(p2.alignments).toEqual(["none", "right"]);
    expect(p2.rows[0]).toEqual(["1", "3"]);
  });
  it("deleteColumn refuses to leave zero columns", () => {
    const single = emptyTable(1, 1);
    expect(deleteColumn(single, 0)).toBe(single);
  });
  it("setAlignment updates only that column", () => {
    const p = parseTable(T)!;
    const p2 = setAlignment(p, 0, "center");
    expect(p2.alignments).toEqual(["center", "center", "right"]);
  });
});

describe("emptyTable", () => {
  it("creates a 2x2 with placeholder headers", () => {
    const t = emptyTable();
    expect(t.header).toEqual(["Col 1", "Col 2"]);
    expect(t.rows.length).toBe(2);
    expect(t.rows[0]).toEqual(["", ""]);
  });
});
