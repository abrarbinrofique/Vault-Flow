/**
 * Adds a small "Copy" button widget to the top-right of each fenced code block.
 * Widget copies the code content (excluding fence lines and language tag).
 */

import { type Extension, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

class CopyButtonWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: CopyButtonWidget) {
    return other.text === this.text;
  }
  toDOM() {
    const btn = document.createElement("button");
    btn.className = "cm-copy-btn";
    btn.type = "button";
    btn.contentEditable = "false";
    btn.setAttribute("aria-label", "Copy code");
    btn.title = "Copy";
    btn.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg><span>Copy</span>';
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(this.text);
        const label = btn.querySelector("span");
        if (label) {
          const prev = label.textContent;
          label.textContent = "Copied";
          btn.classList.add("is-copied");
          setTimeout(() => {
            label.textContent = prev;
            btn.classList.remove("is-copied");
          }, 1200);
        }
      } catch {
        /* clipboard may fail in insecure contexts */
      }
    });
    return btn;
  }
  ignoreEvent() {
    return false;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const decos: Range<Decoration>[] = [];
  const tree = syntaxTree(view.state);
  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter(node) {
        if (node.name !== "FencedCode") return;
        // Extract code content: everything between the opening and closing CodeMark.
        const doc = view.state.doc;
        const openLine = doc.lineAt(node.from);
        const closeLine = doc.lineAt(node.to);
        const contentFrom =
          openLine.to + 1 > node.to ? node.to : openLine.to + 1;
        const contentTo = closeLine.from > contentFrom ? closeLine.from - 1 : node.to;
        const text = view.state.sliceDoc(contentFrom, Math.max(contentFrom, contentTo));
        // Place widget at the end of the opening fence line, side=1 so cursor
        // isn't blocked and the widget doesn't count as an atomic range.
        decos.push(
          Decoration.widget({
            widget: new CopyButtonWidget(text),
            side: 1,
          }).range(openLine.to),
        );
      },
    });
  }
  return Decoration.set(decos, true);
}

export function codeCopyButtons(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}
