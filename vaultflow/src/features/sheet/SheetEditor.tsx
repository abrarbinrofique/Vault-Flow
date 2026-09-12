import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { debounce } from "../../lib/debounce";
import { useVaultStore } from "../../stores/useVaultStore";
import Icon from "../../components/Icon";
import {
  addChart,
  addColumnAt,
  addRowAt,
  deleteChart,
  deleteColumn,
  deleteRow,
  parseSheet,
  renameColumn,
  serializeSheet,
  setCell,
  toNumber,
  updateChart,
  type SheetCell,
  type SheetChart,
  type SheetData,
  type SheetRow,
} from "./sheetModel";
import { promptText } from "../../components/dialog";

// Lazy chunks — the grid + charts only load when a sheet note is opened.
import { loadGrid, type GridModule } from "./gridLoader";

import { lazy } from "react";
const ChartsLazy = lazy(() => import("./ChartsPane"));

interface Props {
  noteId: string;
  initialContent: string;
  theme: "light" | "dark";
}

export default function SheetEditor({ noteId, initialContent, theme }: Props) {
  const [data, setData] = useState<SheetData>(() => parseSheet(initialContent));
  const [grid, setGrid] = useState<GridModule | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadGrid().then((m) => {
      if (!cancelled) setGrid(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const noteIdRef = useRef(noteId);
  useEffect(() => {
    noteIdRef.current = noteId;
  }, [noteId]);

  // If the note swaps to a different sheet under the hood, reload.
  const lastNoteId = useRef(noteId);
  useEffect(() => {
    if (lastNoteId.current !== noteId) {
      lastNoteId.current = noteId;
      setData(parseSheet(initialContent));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const persist = useMemo(
    () =>
      debounce((id: string, content: string) => {
        void useVaultStore.getState().updateNoteContent(id, content);
      }, 400),
    [],
  );
  useEffect(() => () => persist.flush(), [persist]);

  const mutate = (next: SheetData) => {
    setData(next);
    persist(noteIdRef.current, serializeSheet(next));
  };

  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const gridColumns = useMemo(
    () =>
      data.columns.map((c, i) => ({
        key: c.key,
        name: c.name,
        width: c.width,
        resizable: true,
        editable: true,
        renderEditCell: grid?.renderTextEditor,
        renderHeaderCell: () => (
          <button
            className="w-full truncate text-left"
            onClick={async () => {
              const name = await promptText({
                title: "Rename column",
                label: "Column name",
                initialValue: c.name,
                submitLabel: "Rename",
              });
              if (name) mutate(renameColumn(data, i, name));
            }}
            onFocus={() => setSelectedCol(i)}
            style={{
              padding: "4px 8px",
              color: "var(--vf-fg)",
              fontWeight: 600,
              background: selectedCol === i ? "var(--vf-accent-soft)" : "transparent",
            }}
            title="Click to rename"
          >
            {c.name}
          </button>
        ),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, selectedCol, grid],
  );

  const onRowsChange = (
    rows: SheetRow[],
    indexes: { indexes: number[]; column: { key: string } },
  ) => {
    let next = data;
    for (const i of indexes.indexes) {
      const row = rows[i];
      const cell = row[indexes.column.key] as SheetCell;
      next = setCell(next, String(row.id), indexes.column.key, cell ?? "");
    }
    mutate(next);
  };

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--vf-bg)" }}>
      <Toolbar
        onAddRow={() => mutate(addRowAt(data, selectedRow !== null ? selectedRow + 1 : data.rows.length))}
        onDeleteRow={() => selectedRow !== null && mutate(deleteRow(data, selectedRow))}
        canDeleteRow={selectedRow !== null && data.rows.length > 1}
        onAddCol={() => mutate(addColumnAt(data, selectedCol !== null ? selectedCol + 1 : data.columns.length))}
        onDeleteCol={() => selectedCol !== null && mutate(deleteColumn(data, selectedCol))}
        canDeleteCol={selectedCol !== null && data.columns.length > 1}
        onAddChart={async () => {
          const yFirst = data.columns[1]?.key ?? data.columns[0]?.key;
          if (!yFirst || !data.columns[0]) return;
          mutate(
            addChart(data, {
              type: "bar",
              title: `Chart ${data.charts.length + 1}`,
              xKey: data.columns[0].key,
              yKeys: [yFirst],
            }),
          );
        }}
      />
      <div className="flex min-h-0 flex-1">
        <div className={data.charts.length > 0 ? "flex-1" : "w-full"} style={{ minWidth: 0 }}>
          {!grid ? (
            <LoadingCanvas label="Loading grid…" />
          ) : (
            <div
              className={theme === "dark" ? "rdg-dark" : "rdg-light"}
              style={{ height: "100%", padding: 8 }}
              onFocus={(e) => {
                // Capture row focus for "add above/below" and "delete row".
                const rowIdx = (e.target as HTMLElement)
                  .closest("[aria-rowindex]")
                  ?.getAttribute("aria-rowindex");
                if (rowIdx) setSelectedRow(Number(rowIdx) - 2); // header is row 1
              }}
              onClick={(e) => {
                const rowIdx = (e.target as HTMLElement)
                  .closest("[aria-rowindex]")
                  ?.getAttribute("aria-rowindex");
                if (rowIdx) setSelectedRow(Number(rowIdx) - 2);
                const colIdx = (e.target as HTMLElement)
                  .closest("[aria-colindex]")
                  ?.getAttribute("aria-colindex");
                if (colIdx) setSelectedCol(Number(colIdx) - 1);
              }}
            >
              <grid.DataGrid
                columns={gridColumns}
                rows={data.rows}
                onRowsChange={onRowsChange}
                rowKeyGetter={(r: SheetRow) => String(r.id)}
                className="fill-grid"
                style={{ height: "100%" }}
                defaultColumnOptions={{ resizable: true, sortable: false }}
              />
            </div>
          )}
        </div>
        {data.charts.length > 0 && (
          <div
            className="flex flex-col gap-3 overflow-y-auto border-l p-3"
            style={{ borderColor: "var(--vf-border)", width: 380, background: "var(--vf-surface)" }}
          >
            <Suspense fallback={<LoadingCanvas label="Loading charts…" />}>
              <ChartsLazy
                data={data}
                onUpdate={(id: string, patch: Partial<SheetChart>) =>
                  mutate(updateChart(data, id, patch))
                }
                onDelete={(id: string) => mutate(deleteChart(data, id))}
                toNumber={(v: unknown) => toNumber(v as SheetCell)}
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}

function Toolbar({
  onAddRow,
  onDeleteRow,
  canDeleteRow,
  onAddCol,
  onDeleteCol,
  canDeleteCol,
  onAddChart,
}: {
  onAddRow: () => void;
  onDeleteRow: () => void;
  canDeleteRow: boolean;
  onAddCol: () => void;
  onDeleteCol: () => void;
  canDeleteCol: boolean;
  onAddChart: () => void;
}) {
  const btn = "vf-btn";
  return (
    <div
      className="flex items-center gap-1 border-b px-3"
      style={{ height: 40, borderColor: "var(--vf-border)", background: "var(--vf-topbar)" }}
    >
      <button className={btn} onClick={onAddRow} style={{ height: 24, fontSize: 12 }}>
        <Icon name="plus" size={12} /> Row
      </button>
      <button
        className={btn}
        onClick={onDeleteRow}
        disabled={!canDeleteRow}
        style={{ height: 24, fontSize: 12, opacity: canDeleteRow ? 1 : 0.4 }}
      >
        <Icon name="trash" size={12} /> Row
      </button>
      <span style={{ width: 8 }} />
      <button className={btn} onClick={onAddCol} style={{ height: 24, fontSize: 12 }}>
        <Icon name="plus" size={12} /> Column
      </button>
      <button
        className={btn}
        onClick={onDeleteCol}
        disabled={!canDeleteCol}
        style={{ height: 24, fontSize: 12, opacity: canDeleteCol ? 1 : 0.4 }}
      >
        <Icon name="trash" size={12} /> Column
      </button>
      <span style={{ flex: 1 }} />
      <button
        className="vf-btn vf-btn-primary"
        onClick={onAddChart}
        style={{ height: 24, fontSize: 12 }}
      >
        <Icon name="graph" size={12} /> Add chart
      </button>
    </div>
  );
}

function LoadingCanvas({ label }: { label: string }) {
  return (
    <div
      className="flex h-full items-center justify-center text-sm"
      style={{ color: "var(--vf-muted)" }}
    >
      {label}
    </div>
  );
}
