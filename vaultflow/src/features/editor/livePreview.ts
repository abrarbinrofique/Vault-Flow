import { RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

const WIKILINK_RE = /(?<!!)\[\[([^\]|#\n]+)(?:\|([^\]\n]+))?\]\]/g;

const hide = Decoration.mark({ class: "cm-wl-hide" });

class AliasWidget extends WidgetType {
  constructor(readonly alias: string) {
    super();
  }
  eq(other: AliasWidget) {
    return other.alias === this.alias;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-wl-alias";
    span.textContent = this.alias;
    return span;
  }
}
const aliasReplace = (alias: string) =>
  Decoration.replace({ widget: new AliasWidget(alias) });

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const sel = view.state.selection;
  const cursorLines = new Set<number>();
  for (const r of sel.ranges) {
    const line = view.state.doc.lineAt(r.head).number;
    cursorLines.add(line);
  }

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    WIKILINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WIKILINK_RE.exec(text)) !== null) {
      const absStart = from + m.index;
      const absEnd = absStart + m[0].length;
      const lineNo = view.state.doc.lineAt(absStart).number;
      // Do not decorate the line the cursor is on, so editing feels natural.
      if (cursorLines.has(lineNo)) continue;

      const alias = m[2];
      if (alias) {
        // Replace whole [[title|alias]] with just alias.
        builder.add(absStart, absEnd, aliasReplace(alias));
      } else {
        // Hide the surrounding [[ and ]].
        builder.add(absStart, absStart + 2, hide);
        builder.add(absEnd - 2, absEnd, hide);
      }
    }
  }
  return builder.finish();
}

export function livePreview(): Extension {
  const plugin = ViewPlugin.fromClass(
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
    },
  );

  const theme = EditorView.baseTheme({
    ".cm-wl-hide": { opacity: "0", fontSize: "0.001em" },
    ".cm-wl-alias": {
      color: "#2563eb",
      textDecoration: "underline",
      cursor: "pointer",
    },
    "&dark .cm-wl-alias": { color: "#60a5fa" },
  });

  return [plugin, theme];
}
