import { useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon";
import { loadGrid, type GridModule } from "../sheet/gridLoader";
import {
  addColumnAt,
  addRowAt,
  deleteColumn,
  deleteRow,
  parseSheet,
  renameColumn,
  serializeSheet,
  setCell,
  type SheetCell,
  type SheetData,
  type SheetRow,
} from "../sheet/sheetModel";
import { promptText } from "../../components/dialog";

interface Props {
  jsonPayload: string;
  onSerialize: (nextJson: string) => void;
  onFocusEdit: () => void;
}

/**
 * Minimal inline Excel-style grid used inside a fenced ```sheet code block.
 * Reuses the same react-data-grid lazy chunk as the full sheet note editor.
 */
export default function InlineSheet({ jsonPayload, onSerialize, onFocusEdit }: Props) {
  const [data, setData] = useState<SheetData>(() => parseSheet(jsonPayload));
  const [grid, setGrid] = useState<GridModule | null>(null);
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  // Reload from the underlying markdown when the external payload changes
  // (e.g. user typed in the raw code block temporarily, or undo/redo).
  useEffect(() => {
    setData(parseSheet(jsonPayload));
  }, [jsonPayload]);

  useEffect(() => {
    let cancelled = false;
    loadGrid().then((m) => {
      if (!cancelled) setGrid(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const mutate = (next: SheetData) => {
    setData(next);
    onSerialize(serializeSheet(next));
  };

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
              padding: "2px 6px",
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

  const height = Math.min(360, 44 + data.rows.length * 36 + 16);

  return (
    <div
      className="my-2 overflow-hidden"
      style={{
        border: "1px solid var(--vf-border)",
        borderRadius: "var(--vf-radius)",
        background: "var(--vf-surface)",
      }}
      onClick={onFocusEdit}
    >
      <div
        className="flex items-center gap-1 border-b px-2"
        style={{
          height: 32,
          borderColor: "var(--vf-border)",
          background: "var(--vf-topbar)",
        }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <MiniBtn onClick={() => mutate(addRowAt(data, selectedRow !== null ? selectedRow + 1 : data.rows.length))}>
          <Icon name="plus" size={11} /> Row
        </MiniBtn>
        <MiniBtn
          onClick={() => selectedRow !== null && mutate(deleteRow(data, selectedRow))}
          disabled={selectedRow === null || data.rows.length <= 1}
        >
          <Icon name="trash" size={11} /> Row
        </MiniBtn>
        <span style={{ width: 6 }} />
        <MiniBtn onClick={() => mutate(addColumnAt(data, selectedCol !== null ? selectedCol + 1 : data.columns.length))}>
          <Icon name="plus" size={11} /> Col
        </MiniBtn>
        <MiniBtn
          onClick={() => selectedCol !== null && mutate(deleteColumn(data, selectedCol))}
          disabled={selectedCol === null || data.columns.length <= 1}
        >
          <Icon name="trash" size={11} /> Col
        </MiniBtn>
        <span style={{ flex: 1 }} />
        <span className="text-[10.5px]" style={{ color: "var(--vf-subtle)" }}>
          Inline spreadsheet
        </span>
      </div>
      <div
        className="rdg-light"
        style={{ height, padding: 6 }}
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
        {!grid ? (
          <div
            className="flex h-full items-center justify-center text-xs"
            style={{ color: "var(--vf-muted)" }}
          >
            Loading grid…
          </div>
        ) : (
          <grid.DataGrid
            columns={gridColumns}
            rows={data.rows}
            onRowsChange={onRowsChange}
            rowKeyGetter={(r: SheetRow) => String(r.id)}
            className="fill-grid"
            style={{ height: "100%" }}
            defaultColumnOptions={{ resizable: true, sortable: false }}
          />
        )}
      </div>
    </div>
  );
}

function MiniBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className="vf-btn"
      style={{
        height: 22,
        padding: "0 6px",
        fontSize: 11,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
