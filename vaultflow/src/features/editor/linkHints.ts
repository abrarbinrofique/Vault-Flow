/**
 * Inline link suggestions: dashed underline on any text that matches a note
 * title (>= 3 chars, case-insensitive, word-boundary), when the text isn't
 * already inside [[...]] or a code region. Click / Ctrl+L converts to a
 * proper wikilink. Debounced by 300ms on doc changes.
 */

import { type Extension, type Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  keymap,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { useVaultStore } from "../../stores/useVaultStore";
import { useUiStore } from "../../stores/useUiStore";

const HINT_MARK = Decoration.mark({
  class: "cm-link-hint",
  attributes: { title: "Click or press Ctrl+L to link" },
});

const WIKILINK_RE = /\[\[[^\]]*\]\]/g;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function currentNoteId(): string | null {
  return useVaultStore.getState().activeNoteId;
}

function buildTitleRegex(): { re: RegExp; titles: Map<string, string> } | null {
  const state = useVaultStore.getState();
  const activeId = state.activeNoteId;
  const titles = new Map<string, string>(); // lowercased → canonical title
  const words: string[] = [];
  for (const n of Object.values(state.notes)) {
    if (n.id === activeId) continue; // don't suggest linking to the note you're in
    const t = n.title.trim();
    if (t.length < 3) continue;
    const key = t.toLowerCase();
    if (titles.has(key)) continue;
    titles.set(key, t);
    words.push(escapeRegex(t));
  }
  if (words.length === 0) return null;
  // Sort longest-first so overlapping titles prefer the longer match.
  words.sort((a, b) => b.length - a.length);
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}_])(?:${words.join("|")})(?![\\p{L}\\p{N}_])`,
    "giu",
  );
  return { re, titles };
}

function computeExcludedRanges(view: EditorView): { from: number; to: number }[] {
  const excluded: { from: number; to: number }[] = [];
  const tree = syntaxTree(view.state);

  // Code blocks + inline code from the syntax tree.
  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter(node) {
        const name = node.name;
        if (
          name === "FencedCode" ||
          name === "CodeBlock" ||
          name === "InlineCode"
        ) {
          excluded.push({ from: node.from, to: node.to });
        }
      },
    });
  }
  return excluded;
}

function isExcluded(
  pos: number,
  ranges: { from: number; to: number }[],
): boolean {
  for (const r of ranges) {
    if (pos >= r.from && pos < r.to) return true;
  }
  return false;
}

function buildDecorations(view: EditorView): DecorationSet {
  if (!useUiStore.getState().linkHintsEnabled) return Decoration.none;
  const built = buildTitleRegex();
  if (!built) return Decoration.none;
  const { re } = built;

  const excluded = computeExcludedRanges(view);
  const decos: Range<Decoration>[] = [];

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);

    // Ranges of [[wikilinks]] inside this slice — we must NOT decorate inside them.
    const wikiRanges: { from: number; to: number }[] = [];
    WIKILINK_RE.lastIndex = 0;
    let wm: RegExpExecArray | null;
    while ((wm = WIKILINK_RE.exec(text)) !== null) {
      wikiRanges.push({ from: from + wm.index, to: from + wm.index + wm[0].length });
    }

    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const absStart = from + m.index;
      const absEnd = absStart + m[0].length;
      if (isExcluded(absStart, excluded)) continue;
      if (isExcluded(absStart, wikiRanges)) continue;
      decos.push(HINT_MARK.range(absStart, absEnd));
    }
  }

  decos.sort((a, b) => a.from - b.from);
  return Decoration.set(decos, true);
}

/** Convert the hint range at pos into a wikilink. */
function convertAt(view: EditorView, pos: number, decorations: DecorationSet): boolean {
  let hit: { from: number; to: number } | null = null;
  decorations.between(pos, pos, (from, to) => {
    hit = { from, to };
    return false;
  });
  if (!hit) return false;
  const { from, to } = hit as { from: number; to: number };
  const original = view.state.doc.sliceString(from, to);
  const titles = buildTitleRegex()?.titles;
  const canonical = titles?.get(original.toLowerCase()) ?? original;
  const insert =
    canonical === original ? `[[${canonical}]]` : `[[${canonical}|${original}]]`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
  });
  return true;
}

class LinkHintsPlugin {
  decorations: DecorationSet;
  private view: EditorView;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private unsub: () => void;

  constructor(view: EditorView) {
    this.view = view;
    this.decorations = buildDecorations(view);
    // Rebuild whenever the notes list changes (rename / create / delete) or
    // the setting toggles.
    this.unsub = useVaultStore.subscribe(() => this.schedule(0));
    const unsubUi = useUiStore.subscribe(() => this.schedule(0));
    const prevUnsub = this.unsub;
    this.unsub = () => {
      prevUnsub();
      unsubUi();
    };
  }

  update(update: ViewUpdate) {
    if (update.docChanged) this.schedule(300);
    else if (update.viewportChanged) this.recompute();
  }

  destroy() {
    if (this.timer) clearTimeout(this.timer);
    this.unsub();
  }

  private schedule(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.recompute();
      // Dispatch a no-op so the plugin's `decorations` getter is re-read.
      this.view.dispatch({});
    }, ms);
  }

  private recompute() {
    this.decorations = buildDecorations(this.view);
  }
}

const linkHintsPlugin = ViewPlugin.fromClass(LinkHintsPlugin, {
  decorations: (v) => v.decorations,
  eventHandlers: {
    click(event, view) {
      if (event.button !== 0) return;
      if (event.altKey) return;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return;
      const plugin = view.plugin(linkHintsPlugin);
      if (!plugin) return;
      if (convertAt(view, pos, plugin.decorations)) {
        event.preventDefault();
      }
    },
  },
});

const convertKeymap = keymap.of([
  {
    key: "Ctrl-l",
    mac: "Cmd-l",
    run: (view) => {
      const plugin = view.plugin(linkHintsPlugin);
      if (!plugin) return false;
      const pos = view.state.selection.main.head;
      return convertAt(view, pos, plugin.decorations);
    },
  },
]);

export function linkHints(): Extension {
  return [
    linkHintsPlugin,
    convertKeymap,
    EditorView.baseTheme({
      ".cm-link-hint": {
        borderBottom: "1px dashed",
        cursor: "pointer",
      },
    }),
  ];
}

// Prevents current-note self-linking when it isn't relevant (used elsewhere).
export function _currentNoteId(): string | null {
  return currentNoteId();
}
