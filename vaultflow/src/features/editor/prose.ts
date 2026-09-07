/**
 * Markdown "live styling" extensions: heading sizes, bold/italic, blockquote,
 * inline code, code blocks, and a decoration for #tag chips.
 *
 * All CSS lives in globals.css so tokens (accent, muted, surface) can theme it.
 * These extensions add class names, they don't recreate the EditorView.
 */

import { RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { syntaxTree } from "@codemirror/language";

// -- syntax-based highlighting for markdown ---------------------------------

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

// -- block-level decorations (code blocks get mono font; blockquotes get bar)

function buildBlockDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(view.state);
  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter(node) {
        const name = node.name;
        if (name === "FencedCode" || name === "CodeBlock") {
          // Add line class to each line in the code block so CSS can apply mono font.
          const startLine = view.state.doc.lineAt(node.from).number;
          const endLine = view.state.doc.lineAt(node.to).number;
          for (let n = startLine; n <= endLine; n++) {
            const line = view.state.doc.line(n);
            builder.add(
              line.from,
              line.from,
              Decoration.line({ class: "cm-md-codeblock" }),
            );
          }
        } else if (name === "Blockquote") {
          const startLine = view.state.doc.lineAt(node.from).number;
          const endLine = view.state.doc.lineAt(node.to).number;
          for (let n = startLine; n <= endLine; n++) {
            const line = view.state.doc.line(n);
            builder.add(
              line.from,
              line.from,
              Decoration.line({ class: "cm-md-blockquote" }),
            );
          }
        } else if (
          name === "ATXHeading1" ||
          name === "ATXHeading2" ||
          name === "ATXHeading3" ||
          name === "ATXHeading4"
        ) {
          const level = name.slice(-1);
          const line = view.state.doc.lineAt(node.from);
          builder.add(
            line.from,
            line.from,
            Decoration.line({ class: `cm-md-heading cm-md-heading-${level}` }),
          );
        }
      },
    });
  }
  return builder.finish();
}

function blockDecorations(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildBlockDecorations(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildBlockDecorations(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

// -- #tag inline decoration -------------------------------------------------

const TAG_RE = /(^|\s)(#[\w/-]+)/g;

function buildTagDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const mark = Decoration.mark({ class: "cm-md-tag" });
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    TAG_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TAG_RE.exec(text)) !== null) {
      const tagStart = from + m.index + m[1].length;
      const tagEnd = tagStart + m[2].length;
      builder.add(tagStart, tagEnd, mark);
    }
  }
  return builder.finish();
}

function tagDecorations(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildTagDecorations(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildTagDecorations(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

export function proseStyling(): Extension {
  return [
    syntaxHighlighting(mdHighlight),
    blockDecorations(),
    tagDecorations(),
  ];
}
