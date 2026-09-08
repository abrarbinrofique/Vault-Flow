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
  WidgetType,
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
const LIST_LINE = Decoration.line({ class: "cm-md-listitem" });

class TaskCheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }
  eq(other: TaskCheckboxWidget) {
    return (
      other.checked === this.checked &&
      other.from === this.from &&
      other.to === this.to
    );
  }
  toDOM(view: EditorView) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "cm-task-checkbox";
    input.checked = this.checked;
    input.contentEditable = "false";
    input.setAttribute("aria-label", "Toggle task");
    input.addEventListener("mousedown", (e) => e.preventDefault());
    input.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = this.checked ? "[ ]" : "[x]";
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: next },
      });
    });
    return input;
  }
  ignoreEvent() {
    return false;
  }
}

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

        // Horizontal rule: line class + hide/dim the --- or *** marker
        if (name === "HorizontalRule") {
          const line = view.state.doc.lineAt(node.from);
          decos.push(
            Decoration.line({ class: "cm-md-hr" }).range(line.from),
          );
          if (activeLines.has(line.number)) {
            decos.push(DIM.range(node.from, node.to));
          } else {
            decos.push(HIDE.range(node.from, node.to));
          }
          return;
        }

        // Markdown link [text](url) — hide brackets and (url) off active line
        if (name === "Link") {
          const line = view.state.doc.lineAt(node.from).number;
          const isActive = activeLines.has(line);
          const c = node.node.cursor();
          if (c.firstChild()) {
            do {
              if (c.name === "LinkMark" || c.name === "URL") {
                if (isActive) decos.push(DIM.range(c.from, c.to));
                else decos.push(HIDE.range(c.from, c.to));
              }
            } while (c.nextSibling());
          }
          return;
        }

        // Lists: hanging indent per line + task checkbox widget
        if (name === "ListItem") {
          const startLine = view.state.doc.lineAt(node.from).number;
          const endLine = view.state.doc.lineAt(node.to).number;
          for (let n = startLine; n <= endLine; n++) {
            const line = view.state.doc.line(n);
            decos.push(LIST_LINE.range(line.from));
          }

          // Task marker inside the list item?
          const c = node.node.cursor();
          if (c.firstChild()) {
            do {
              if (c.name === "TaskMarker") {
                const text = view.state.sliceDoc(c.from, c.to);
                const checked = text.toLowerCase().includes("x");
                decos.push(
                  Decoration.replace({
                    widget: new TaskCheckboxWidget(checked, c.from, c.to),
                  }).range(c.from, c.to),
                );
              }
            } while (c.nextSibling());
          }
          return;
        }

        // Inline code `foo` — hide/dim the backtick CodeMarks
        if (name === "InlineCode") {
          const line = view.state.doc.lineAt(node.from).number;
          const isActive = activeLines.has(line);
          const c = node.node.cursor();
          if (c.firstChild()) {
            do {
              if (c.name === "CodeMark") {
                if (isActive) decos.push(DIM.range(c.from, c.to));
                else decos.push(HIDE.range(c.from, c.to));
              }
            } while (c.nextSibling());
          }
          return;
        }

        // Bold / Italic / Bold+Italic / Strikethrough — hide the ** * _ ~~ marks
        if (
          name === "StrongEmphasis" ||
          name === "Emphasis" ||
          name === "Strikethrough"
        ) {
          const markName =
            name === "Strikethrough" ? "StrikethroughMark" : "EmphasisMark";
          const line = view.state.doc.lineAt(node.from).number;
          const isActive = activeLines.has(line);
          const c = node.node.cursor();
          if (c.firstChild()) {
            do {
              if (c.name === markName) {
                if (isActive) {
                  decos.push(DIM.range(c.from, c.to));
                } else {
                  decos.push(HIDE.range(c.from, c.to));
                }
              }
            } while (c.nextSibling());
          }
          return;
        }

        // Fenced code blocks: mono line + surface bar; hide/dim ``` fences
        if (name === "FencedCode" || name === "CodeBlock") {
          const startLine = view.state.doc.lineAt(node.from).number;
          const endLine = view.state.doc.lineAt(node.to).number;
          for (let n = startLine; n <= endLine; n++) {
            const line = view.state.doc.line(n);
            const cls =
              n === startLine
                ? "cm-md-codeblock cm-md-codeblock-first"
                : n === endLine
                  ? "cm-md-codeblock cm-md-codeblock-last"
                  : "cm-md-codeblock";
            decos.push(Decoration.line({ class: cls }).range(line.from));
          }

          if (name === "FencedCode") {
            // Always DIM (never fully hide) the ``` fences and language tag —
            // hiding an unclosed opening fence trapped users because they
            // couldn't tell the block was still open.
            const c = node.node.cursor();
            if (c.firstChild()) {
              do {
                if (c.name === "CodeMark" || c.name === "CodeInfo") {
                  decos.push(DIM.range(c.from, c.to));
                }
              } while (c.nextSibling());
            }
          }
          return;
        }

        // Blockquotes: left border, hide/dim > marks per line
        if (name === "Blockquote") {
          const startLine = view.state.doc.lineAt(node.from).number;
          const endLine = view.state.doc.lineAt(node.to).number;
          for (let n = startLine; n <= endLine; n++) {
            const line = view.state.doc.line(n);
            decos.push(
              Decoration.line({ class: "cm-md-blockquote" }).range(line.from),
            );
          }
          const c = node.node.cursor();
          if (c.firstChild()) {
            do {
              if (c.name === "QuoteMark") {
                const markLine = view.state.doc.lineAt(c.from).number;
                // Include the single space after > if present.
                const trailingSpace =
                  view.state.sliceDoc(c.to, c.to + 1) === " " ? 1 : 0;
                const to = c.to + trailingSpace;
                if (activeLines.has(markLine)) {
                  decos.push(DIM.range(c.from, to));
                } else {
                  decos.push(HIDE.range(c.from, to));
                }
              }
            } while (c.nextSibling());
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
