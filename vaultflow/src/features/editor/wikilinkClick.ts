import { RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { useVaultStore } from "../../stores/useVaultStore";

const WIKILINK_RE = /(?<!!)\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;

const linkMark = Decoration.mark({
  class: "cm-wikilink",
  attributes: { title: "Click to open (Alt+click to place cursor)" },
});

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    WIKILINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WIKILINK_RE.exec(text)) !== null) {
      const start = from + m.index;
      const end = start + m[0].length;
      builder.add(start, end, linkMark);
    }
  }
  return builder.finish();
}

async function openOrCreate(title: string) {
  const state = useVaultStore.getState();
  const existing = Object.values(state.notes).find(
    (n) => n.title.toLowerCase() === title.toLowerCase(),
  );
  if (existing) {
    state.setActiveNote(existing.id);
    return;
  }
  await state.createNote({ title });
}

function titleAtPos(view: EditorView, pos: number): string | null {
  const line = view.state.doc.lineAt(pos);
  WIKILINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_RE.exec(line.text)) !== null) {
    const start = line.from + m.index;
    const end = start + m[0].length;
    if (pos >= start && pos <= end) return m[1].trim();
  }
  return null;
}

export function wikilinkClick(): Extension {
  const plugin = ViewPlugin.fromClass(
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
    {
      decorations: (v) => v.decorations,
      eventHandlers: {
        mousedown(event, view) {
          if (event.button !== 0) return;
          if (event.altKey) return; // hold Alt to place cursor without navigating
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos == null) return;
          const title = titleAtPos(view, pos);
          if (!title) return;
          event.preventDefault();
          void openOrCreate(title);
        },
      },
    },
  );

  const theme = EditorView.baseTheme({
    ".cm-wikilink": {
      color: "#2563eb",
      textDecoration: "underline",
      cursor: "pointer",
    },
    "&dark .cm-wikilink": { color: "#60a5fa" },
  });

  return [plugin, theme];
}
