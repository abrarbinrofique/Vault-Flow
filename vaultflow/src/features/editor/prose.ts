/**
 * Live markdown decorations — no text mutation, viewport-scoped, syntax-tree
 * driven. Behaviour follows Obsidian's Live Preview:
 *   - Lines the cursor is NOT on: syntax characters are hidden.
 *   - Line the cursor IS on: syntax characters remain but are dimmed.
 * Raw markdown remains the source of truth for save / index / search.
 *
 * Incremental buildout:
 *   1. Headings — hide `#` markers off active line, dim on active line.
 *   (blockquote / code block / tag chip line styling is kept from the earlier
 *   polish pass; syntax hiding for those will be added in later increments.)
 */

import { type Extension, type Range, RangeSet } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// -- syntax-based highlighting ---------------------------------------------

const mdHighlight = HighlightStyle.define([
  { tag: t.heading1, class: "cm-md-h1" },
  { tag: t.heading2, class: "cm-md-h2" },
  { tag: t.heading3, class: "cm-md-h3" },
  { tag: t.heading4, class: "cm-md-h4" },
  { tag: t.strong, class: "cm-md-strong" },
  { tag: t.emphasis, class: "cm-md-em" },
  { tag: t.strikethrough, class: "cm-md-strike" },
  { tag: t.monospace, class: "cm-md-code-inline" },
  { tag: t.link, class: "cm-md-link" },
  { tag: t.url, class: "cm-md-url" },
  { tag: t.quote, class: "cm-md-quote" },
  { tag: t.list, class: "cm-md-list-marker" },
  { tag: t.meta, class: "cm-md-meta" },
]);

// -- helpers ---------------------------------------------------------------

function activeLineSet(view: EditorView): Set<number> {
  const s = new Set<number>();
  for (const r of view.state.selection.ranges) {
    s.add(view.state.doc.lineAt(r.head).number);
    if (!r.empty) s.add(view.state.doc.lineAt(r.anchor).number);
  }
  return s;
}

const HIDE = Decoration.replace({});
const DIM = Decoration.mark({ class: "cm-md-syntax" });
const TAG_MARK = Decoration.mark({ class: "cm-md-tag" });

const TAG_RE = /(^|\s)(#[\w/-]+)/g;

// -- main decoration builder -----------------------------------------------

function buildDecorations(view: EditorView): DecorationSet {
  const decos: Range<Decoration>[] = [];
  const tree = syntaxTree(view.state);
  const activeLines = activeLineSet(view);

  for (const { from, to } of view.visibleRanges) {
    // ---- syntax-tree passes ----
    tree.iterate({
      from,
      to,
      enter(node) {
        const name = node.name;

        // Headings
        if (
          name === "ATXHeading1" ||
          name === "ATXHeading2" ||
          name === "ATXHeading3" ||
          name === "ATXHeading4" ||
          name === "ATXHeading5" ||
          name === "ATXHeading6"
        ) {
          const level = name.slice(-1);
          const line = view.state.doc.lineAt(node.from);
          decos.push(
            Decoration.line({
              class: `cm-md-heading cm-md-heading-${level}`,
            }).range(line.from),
          );

          const mark = node.node.getChild("HeaderMark");
          if (mark) {
            const followsSpace =
              view.state.sliceDoc(mark.to, mark.to + 1) === " ";
            const rangeEnd = mark.to + (followsSpace ? 1 : 0);
            if (activeLines.has(line.number)) {
              decos.push(DIM.range(mark.from, rangeEnd));
            } else {
              decos.push(HIDE.range(mark.from, rangeEnd));
            }
          }
          return;
        }

        // Fenced code blocks: mono line + surface bar
        if (name === "FencedCode" || name === "CodeBlock") {
          const startLine = view.state.doc.lineAt(node.from).number;
          const endLine = view.state.doc.lineAt(node.to).number;
          for (let n = startLine; n <= endLine; n++) {
            const line = view.state.doc.line(n);
            decos.push(
              Decoration.line({ class: "cm-md-codeblock" }).range(line.from),
            );
          }
          return;
        }

        // Blockquotes: left border
        if (name === "Blockquote") {
          const startLine = view.state.doc.lineAt(node.from).number;
          const endLine = view.state.doc.lineAt(node.to).number;
          for (let n = startLine; n <= endLine; n++) {
            const line = view.state.doc.line(n);
            decos.push(
              Decoration.line({ class: "cm-md-blockquote" }).range(line.from),
            );
          }
          return;
        }
      },
    });

    // ---- inline #tag pill chips (regex over visible slice) ----
    const text = view.state.sliceDoc(from, to);
    TAG_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TAG_RE.exec(text)) !== null) {
      const tagStart = from + m.index + m[1].length;
      const tagEnd = tagStart + m[2].length;
      decos.push(TAG_MARK.range(tagStart, tagEnd));
    }
  }

  return RangeSet.of(decos, true);
}

const proseDecorationsPlugin = ViewPlugin.fromClass(
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

export function proseStyling(): Extension {
  return [syntaxHighlighting(mdHighlight), proseDecorationsPlugin];
}
