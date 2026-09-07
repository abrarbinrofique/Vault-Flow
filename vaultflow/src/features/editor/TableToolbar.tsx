import { useEffect, useState } from "react";
import type { EditorView } from "@codemirror/view";
import Icon from "../../components/Icon";
import {
  addColumn,
  addRow,
  deleteColumn,
  deleteRow,
  serializeTable,
  setAlignment,
  type Align,
} from "../../lib/mdTable";
import { getTableContext, type TableContext } from "./tableContext";

interface Pos {
  top: number;
  left: number;
  ctx: TableContext;
  view: EditorView;
}

/**
 * Render a small floating toolbar above the currently-edited table cell.
 * The toolbar reads state via getTableContext and mutates the doc via
 * view.dispatch — the raw markdown stays the source of truth.
 */
export default function TableToolbar({ views }: { views: EditorView[] }) {
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(() => {
    if (views.length === 0) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      let next: Pos | null = null;
      for (const v of views) {
        if (!v.hasFocus) continue;
        const sel = v.state.selection.main.head;
        const ctx = getTableContext(v.state, sel);
        if (!ctx) continue;
        const coords = v.coordsAtPos(v.state.doc.lineAt(ctx.from).from);
        if (!coords) continue;
        next = {
          top: Math.max(4, coords.top - 42 + window.scrollY),
          left: coords.left + window.scrollX,
          ctx,
          view: v,
        };
        break;
      }
      setPos((prev) => {
        if (!prev && !next) return prev;
        if (!prev || !next) return next;
        // Only update state when a meaningful piece changed to avoid re-render churn.
        if (
          prev.top === next.top &&
          prev.left === next.left &&
          prev.ctx.from === next.ctx.from &&
          prev.ctx.line === next.ctx.line &&
          prev.ctx.col === next.ctx.col
        ) {
          return prev;
        }
        return next;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [views]);

  if (!pos) return null;
  const { ctx, view } = pos;

  const apply = (newTable: ReturnType<typeof serializeTable> | null) => {
    if (typeof newTable !== "string") return;
    view.dispatch({
      changes: { from: ctx.from, to: ctx.to, insert: newTable },
      selection: {
        anchor: Math.min(
          ctx.from + newTable.length,
          view.state.selection.main.head,
        ),
      },
    });
    view.focus();
  };

  const rowAbove = () =>
    apply(
      serializeTable(
        addRow(ctx.table, ctx.dataRow == null ? 0 : ctx.dataRow),
      ),
    );
  const rowBelow = () =>
    apply(
      serializeTable(
        addRow(ctx.table, ctx.dataRow == null ? ctx.table.rows.length : ctx.dataRow + 1),
      ),
    );
  const rowDelete = () => {
    if (ctx.dataRow == null) return;
    apply(serializeTable(deleteRow(ctx.table, ctx.dataRow)));
  };
  const colLeft = () => apply(serializeTable(addColumn(ctx.table, ctx.col)));
  const colRight = () => apply(serializeTable(addColumn(ctx.table, ctx.col + 1)));
  const colDelete = () => apply(serializeTable(deleteColumn(ctx.table, ctx.col)));
  const align = (a: Align) => apply(serializeTable(setAlignment(ctx.table, ctx.col, a)));

  const currentAlign = ctx.table.alignments[ctx.col] ?? "none";

  return (
    <div
      className="vf-table-toolbar"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        background: "var(--vf-surface)",
        border: "1px solid var(--vf-border)",
        borderRadius: "var(--vf-radius)",
        boxShadow: "var(--vf-shadow-md)",
        zIndex: 30,
        fontSize: 11,
        color: "var(--vf-fg-secondary)",
      }}
    >
      <Btn onClick={rowAbove} title="Add row above" ariaLabel="Add row above">
        <ArrowRow direction="up" />
      </Btn>
      <Btn onClick={rowBelow} title="Add row below" ariaLabel="Add row below">
        <ArrowRow direction="down" />
      </Btn>
      <Btn
        onClick={rowDelete}
        title="Delete row"
        ariaLabel="Delete row"
        disabled={ctx.dataRow == null}
      >
        <Icon name="trash" size={12} />
      </Btn>

      <Sep />

      <Btn onClick={colLeft} title="Add column left" ariaLabel="Add column left">
        <ArrowCol direction="left" />
      </Btn>
      <Btn onClick={colRight} title="Add column right" ariaLabel="Add column right">
        <ArrowCol direction="right" />
      </Btn>
      <Btn
        onClick={colDelete}
        title="Delete column"
        ariaLabel="Delete column"
        disabled={ctx.table.alignments.length <= 1}
      >
        <Icon name="close" size={12} />
      </Btn>

      <Sep />

      <AlignBtn active={currentAlign === "left"} onClick={() => align("left")} title="Align left">
        <AlignIcon lines={[10, 6, 8]} anchor="left" />
      </AlignBtn>
      <AlignBtn active={currentAlign === "center"} onClick={() => align("center")} title="Align center">
        <AlignIcon lines={[10, 6, 8]} anchor="center" />
      </AlignBtn>
      <AlignBtn active={currentAlign === "right"} onClick={() => align("right")} title="Align right">
        <AlignIcon lines={[10, 6, 8]} anchor="right" />
      </AlignBtn>
    </div>
  );
}

function Btn({
  children,
  onClick,
  title,
  ariaLabel,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
      className="vf-icon-btn"
      style={{ width: 22, height: 22, opacity: disabled ? 0.35 : 1 }}
    >
      {children}
    </button>
  );
}

function AlignBtn({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active: boolean;
}) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      className="vf-icon-btn"
      style={{
        width: 22,
        height: 22,
        color: active ? "var(--vf-accent)" : "var(--vf-muted)",
      }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return (
    <span
      style={{
        width: 1,
        height: 14,
        background: "var(--vf-border)",
        margin: "0 2px",
      }}
    />
  );
}

function ArrowRow({ direction }: { direction: "up" | "down" }) {
  const y1 = direction === "up" ? 10 : 6;
  const y2 = direction === "up" ? 3 : 13;
  return (
    <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="12" height="4" rx="0.6" />
      <path d={`M8 ${y1}L8 ${y2}`} />
      <path d={direction === "up" ? "M5 6L8 3L11 6" : "M5 10L8 13L11 10"} />
    </svg>
  );
}

function ArrowCol({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="4" height="12" rx="0.6" />
      {direction === "left" ? (
        <>
          <path d="M6 8L2 8" />
          <path d="M4 6L2 8L4 10" />
        </>
      ) : (
        <>
          <path d="M10 8L14 8" />
          <path d="M12 6L14 8L12 10" />
        </>
      )}
    </svg>
  );
}

function AlignIcon({ lines, anchor }: { lines: number[]; anchor: "left" | "center" | "right" }) {
  return (
    <svg width={13} height={13} viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      {lines.map((w, i) => {
        const y = 4 + i * 3;
        const x =
          anchor === "left" ? 2 : anchor === "right" ? 14 - w : 8 - w / 2;
        return <line key={i} x1={x} y1={y} x2={x + w} y2={y} />;
      })}
    </svg>
  );
}
