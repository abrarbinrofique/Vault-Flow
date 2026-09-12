import { describe, expect, it } from "vitest";
import {
  addChart,
  addColumnAt,
  addRowAt,
  deleteChart,
  deleteColumn,
  deleteRow,
  emptySheet,
  parseSheet,
  renameColumn,
  serializeSheet,
  setCell,
  toNumber,
  updateChart,
} from "./sheetModel";

describe("sheet model", () => {
  it("empty sheet has 3 cols and 3 rows", () => {
    const s = emptySheet();
    expect(s.columns).toHaveLength(3);
    expect(s.rows).toHaveLength(3);
    expect(s.charts).toEqual([]);
  });

  it("round-trips through serialize/parse", () => {
    const s = setCell(emptySheet(), "no-such-id", "col1", "x");
    const s2 = parseSheet(serializeSheet(s));
    expect(s2.columns).toEqual(s.columns);
  });

  it("parseSheet falls back to empty on corrupt input", () => {
    expect(parseSheet("not json").columns).toHaveLength(3);
    expect(parseSheet("{}").columns).toHaveLength(3);
  });

  it("addRowAt inserts a row with all column keys as empty strings", () => {
    const s = addRowAt(emptySheet(), 0);
    expect(s.rows).toHaveLength(4);
    expect(Object.keys(s.rows[0])).toContain("col1");
    expect(s.rows[0].col1).toBe("");
  });

  it("deleteRow removes a row", () => {
    const s = deleteRow(emptySheet(), 1);
    expect(s.rows).toHaveLength(2);
  });

  it("addColumnAt inserts a column and back-fills existing rows", () => {
    const s = addColumnAt(emptySheet(), 1);
    expect(s.columns).toHaveLength(4);
    expect(s.columns[1].key).toBe("col4");
    expect(s.rows[0].col4).toBe("");
  });

  it("deleteColumn refuses to leave zero columns", () => {
    const one: ReturnType<typeof emptySheet> = {
      ...emptySheet(),
      columns: [{ key: "col1", name: "A" }],
      rows: [{ id: "r", col1: "x" }],
    };
    expect(deleteColumn(one, 0)).toBe(one);
  });

  it("deleteColumn removes chart references to the dropped key", () => {
    let s = emptySheet();
    s = addChart(s, {
      type: "bar",
      title: "T",
      xKey: "col1",
      yKeys: ["col2", "col3"],
    });
    const s2 = deleteColumn(s, 1); // drop col2
    expect(s2.charts[0].yKeys).toEqual(["col3"]);
    const s3 = deleteColumn(s2, 0); // drop col1 → chart's xKey is empty, chart pruned
    expect(s3.charts).toHaveLength(0);
  });

  it("renameColumn only touches the target column's name", () => {
    const s = renameColumn(emptySheet(), 0, "Name");
    expect(s.columns[0].name).toBe("Name");
    expect(s.columns[0].key).toBe("col1");
    expect(s.columns[1].name).toBe("B");
  });

  it("setCell replaces the cell in the matching row", () => {
    const base = emptySheet();
    const rowId = base.rows[0].id;
    const s = setCell(base, rowId, "col2", 42);
    expect(s.rows[0].col2).toBe(42);
    expect(s.rows[1].col2).toBe("");
  });

  it("addChart / updateChart / deleteChart round-trip", () => {
    let s = emptySheet();
    s = addChart(s, {
      type: "bar",
      title: "Original",
      xKey: "col1",
      yKeys: ["col2"],
    });
    const id = s.charts[0].id;
    s = updateChart(s, id, { title: "Renamed", type: "line" });
    expect(s.charts[0].title).toBe("Renamed");
    expect(s.charts[0].type).toBe("line");
    s = deleteChart(s, id);
    expect(s.charts).toHaveLength(0);
  });

  it("toNumber coerces strings, keeps numbers, rejects garbage", () => {
    expect(toNumber("42")).toBe(42);
    expect(toNumber(3.14)).toBe(3.14);
    expect(toNumber("")).toBeNull();
    expect(toNumber("abc")).toBeNull();
    expect(toNumber(null)).toBeNull();
  });
});
