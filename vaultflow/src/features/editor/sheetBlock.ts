/**
 * Renders a fenced code block whose language tag is "sheet" as an inline
 * Excel-style spreadsheet widget. The raw JSON stays in the underlying
 * markdown (source of truth) so notes still export as plain markdown; the
 * widget just replaces the block visually and provides edit handlers that
 * dispatch doc changes back to CodeMirror.
 */

import { type Extension, type Range, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import InlineSheet from "./InlineSheet";

interface BlockRange {
  blockFrom: number;
  blockTo: number;
  payloadFrom: number;
  payloadTo: number;
  payload: string;
}

/** Return the payload range (between opening ```sheet\n and closing ``` line). */
function findSheetBlocks(view: EditorView): BlockRange[] {
  const out: BlockRange[] = [];
  const tree = syntaxTree(view.state);
  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter(node) {
        if (node.name !== "FencedCode") return;
        // The CodeInfo child holds the language tag next to the opening ```.
        const info = node.node.getChild("CodeInfo");
        if (!info) return;
        const lang = view.state.sliceDoc(info.from, info.to).trim();
        if (lang !== "sheet") return;

        const doc = view.state.doc;
        const openLine = doc.lineAt(node.from);
        const closeLine = doc.lineAt(node.to);
        const payloadFrom = openLine.to + 1 > node.to ? node.to : openLine.to + 1;
        const payloadTo = closeLine.from > payloadFrom ? closeLine.from - 1 : node.to;
        const payload = view.state.sliceDoc(payloadFrom, Math.max(payloadFrom, payloadTo));
        // block: true replace ranges must span whole lines — include the
        // trailing newline (if present) so CodeMirror recognises the range.
        const blockTo = Math.min(doc.length, closeLine.to + 1);
        out.push({
          blockFrom: openLine.from,
          blockTo,
          payloadFrom,
          payloadTo,
          payload,
        });
      },
    });
  }
  return out;
}

class SheetWidget extends WidgetType {
  private root: Root | null = null;

  constructor(
    readonly view: EditorView,
    readonly payloadFrom: number,
    readonly payloadTo: number,
    readonly payload: string,
  ) {
    super();
  }

  eq(other: SheetWidget) {
    return (
      other.payloadFrom === this.payloadFrom &&
      other.payloadTo === this.payloadTo &&
      other.payload === this.payload
    );
  }

  toDOM() {
    const host = document.createElement("div");
    host.className = "cm-sheet-block";
    host.contentEditable = "false";
    host.style.display = "block";
    host.style.width = "100%";
    host.style.margin = "8px 0";
    // Prevent CodeMirror from stealing focus / drag from the widget interior.
    host.addEventListener("mousedown", (e) => {
      e.stopPropagation();
    });
    this.root = createRoot(host);
    this.render();
    return host;
  }

  updateDOM() {
    // Force a re-render on any update — cheap since React reconciles.
    this.render();
    return true;
  }

  private render() {
    if (!this.root) return;
    this.root.render(
      createElement(InlineSheet, {
        jsonPayload: this.payload,
        onSerialize: (next: string) => this.writeBack(next),
        onFocusEdit: () => {
          /* no-op */
        },
      }),
    );
  }

  private writeBack(next: string) {
    // Guard: only dispatch if this widget's payload range still matches.
    const current = this.view.state.sliceDoc(this.payloadFrom, this.payloadTo);
    if (current !== this.payload) return;
    if (next === this.payload) return;
    this.view.dispatch({
      changes: { from: this.payloadFrom, to: this.payloadTo, insert: next },
    });
  }

  destroy() {
    // Defer unmount out of the current React render cycle.
    const r = this.root;
    this.root = null;
    if (r) setTimeout(() => r.unmount(), 0);
  }

  ignoreEvent() {
    return true;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const decos: Range<Decoration>[] = [];
  const blocks = findSheetBlocks(view);
  for (const b of blocks) {
    // Skip if any selection is inside this block — user is editing the raw
    // markdown, don't replace it while they type.
    const inside = view.state.selection.ranges.some(
      (r) => r.from >= b.blockFrom && r.head <= b.blockTo,
    );
    if (inside) continue;
    decos.push(
      Decoration.replace({
        widget: new SheetWidget(view, b.payloadFrom, b.payloadTo, b.payload),
        block: true,
      }).range(b.blockFrom, b.blockTo),
    );
  }
  // RangeSetBuilder needs sorted input; our list is already document-order.
  decos.sort((a, b) => a.from - b.from);
  for (const d of decos) builder.add(d.from, d.to, d.value);
  return builder.finish();
}

export function sheetBlockWidget(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }
      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet
        ) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
      provide: (plugin) =>
        EditorView.atomicRanges.of((view) => {
          return view.plugin(plugin)?.decorations ?? Decoration.none;
        }),
    },
  );
}
