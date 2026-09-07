import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../components/Icon";
import { searchNotes, useVaultStore } from "../../stores/useVaultStore";
import { snippetFor } from "../../lib/searchIndex";
import { openDailyNote } from "../dailynotes/openDailyNote";
import { useUiStore } from "../../stores/useUiStore";
import {
  listTemplates,
  promptAndCreateFromTemplate,
} from "../templates/newFromTemplate";
import { useSmartStore } from "../../stores/useSmartStore";
import { insertTableAtCursor } from "../editor/insertTable";
import { importLibraryFromPicker } from "../drawing/importLibrary";

interface HighlightedSnippet {
  before: string;
  match: string;
  after: string;
}

interface Item {
  kind: "note" | "command";
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  snippet?: HighlightedSnippet;
  run: () => void | Promise<void>;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const DEBOUNCE_MS = 150;

export default function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const createNote = useVaultStore((s) => s.createNote);
  const notes = useVaultStore((s) => s.notes);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      // Just opened — reset input & focus. Guard with a ref so we don't
      // fire on re-renders while already open.
      setQuery("");
      setDebouncedQuery("");
      setIndex(0);
      inputRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  // Debounce the query so we don't run MiniSearch (and snippet extraction)
  // on every keystroke.
  useEffect(() => {
    if (query === debouncedQuery) return;
    const t = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, debouncedQuery]);

  const items = useMemo<Item[]>(() => {
    if (!open) return [];
    const q = debouncedQuery.trim();
    const out: Item[] = [];

    const hintsOn = useUiStore.getState().linkHintsEnabled;
    const builtins: Item[] = [
      {
        kind: "command",
        id: "cmd:capture",
        label: "Quick capture to Inbox",
        hint: "Ctrl+Shift+Space",
        icon: <Icon name="plus" size={14} />,
        run: () => useUiStore.getState().openQuickCapture(),
      },
      {
        kind: "command",
        id: "cmd:daily",
        label: "Open today's daily note",
        hint: "Command",
        icon: <Icon name="calendar" size={14} />,
        run: () => openDailyNote(),
      },
      {
        kind: "command",
        id: "cmd:import-excalidraw-lib",
        label: "Import shape library (.excalidrawlib)",
        hint: "Drawing",
        icon: <Icon name="pen" size={14} />,
        run: async () => {
          try {
            const r = await importLibraryFromPicker();
            if (r) {
              window.alert(
                `Imported ${r.imported} shape${r.imported === 1 ? "" : "s"}. Library now has ${r.totalAfter}.`,
              );
            }
          } catch (e) {
            window.alert(`Library import failed: ${(e as Error).message}`);
          }
        },
      },
      {
        kind: "command",
        id: "cmd:new-drawing",
        label: "New drawing",
        hint: "Command",
        icon: <Icon name="pen" size={14} />,
        run: async () => {
          const t = window.prompt("New drawing title");
          if (!t) return;
          await useVaultStore
            .getState()
            .createNote({ title: t, kind: "drawing" });
        },
      },
      {
        kind: "command",
        id: "cmd:insert-table",
        label: "Insert table",
        hint: "Command",
        icon: <Icon name="more" size={14} />,
        run: () => {
          if (!insertTableAtCursor())
            window.alert("Focus an editor first, then run this command.");
        },
      },
      ...listTemplates().map<Item>((tpl) => ({
        kind: "command" as const,
        id: `tpl:${tpl.id}`,
        label: `New from template: ${tpl.title}`,
        hint: "Template",
        icon: <Icon name="file" size={14} />,
        run: async () => {
          await promptAndCreateFromTemplate(tpl);
        },
      })),
      {
        kind: "command",
        id: "cmd:toggle-linkhints",
        label: hintsOn
          ? "Turn off inline link hints"
          : "Turn on inline link hints",
        hint: hintsOn ? "On" : "Off",
        icon: <Icon name="link" size={14} />,
        run: () => useUiStore.getState().toggleLinkHints(),
      },
      {
        kind: "command",
        id: "cmd:clear-vault",
        label: "Clear vault (delete all notes)",
        hint: "Danger",
        icon: <Icon name="trash" size={14} />,
        run: async () => {
          const count = Object.keys(useVaultStore.getState().notes).length;
          if (count === 0) {
            window.alert("Vault is already empty.");
            return;
          }
          const answer = window.prompt(
            `This will permanently delete all ${count} note${count === 1 ? "" : "s"} and folder structure from the browser (IndexedDB).\n\nType DELETE to confirm.`,
          );
          if (answer !== "DELETE") return;
          await useVaultStore.getState().clearVault();
        },
      },
    ];

    if (q) {
      const ql = q.toLowerCase();
      for (const b of builtins) if (b.label.toLowerCase().includes(ql)) out.push(b);

      const hits = searchNotes(q, 25);
      for (const h of hits) {
        const note = notes[h.id];
        // Only include a snippet for content-only matches — title matches
        // don't need a body preview since the title itself already shows the hit.
        const snippet =
          note && !h.matchedInTitle && h.matchedInContent
            ? (snippetFor(note.content, h.matchedTerms) ?? undefined)
            : undefined;
        out.push({
          kind: "note",
          id: h.id,
          label: h.title,
          hint: h.matchedInTitle ? "Title" : "Body",
          icon: <Icon name="file" size={14} />,
          snippet,
          run: () => setActiveNote(h.id),
        });
      }

      const exact = Object.values(notes).some(
        (n) => n.title.toLowerCase() === q.toLowerCase(),
      );
      if (!exact) {
        out.push({
          kind: "command",
          id: `create:${q}`,
          label: `Create note "${q}"`,
          hint: "New",
          icon: <Icon name="plus" size={14} />,
          run: async () => {
            await createNote({ title: q });
          },
        });
      }

      out.push({
        kind: "command",
        id: `save-search:${q}`,
        label: `Save search "${q}" as smart folder`,
        hint: "Save",
        icon: <Icon name="search" size={14} />,
        run: async () => {
          const name = window.prompt("Smart folder name", q);
          if (!name) return;
          await useSmartStore.getState().add({ name, query: q });
        },
      });
    } else {
      out.push(...builtins);
      const recent = Object.values(notes)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 20);
      for (const n of recent) {
        out.push({
          kind: "note",
          id: n.id,
          label: n.title,
          hint: "Recent",
          icon: <Icon name="file" size={14} />,
          run: () => setActiveNote(n.id),
        });
      }
    }
    return out;
  }, [open, debouncedQuery, notes, setActiveNote, createNote]);

  const activeIndex = Math.min(index, Math.max(0, items.length - 1));

  if (!open) return null;

  const pick = async (i: number) => {
    const it = items[i];
    if (!it) return;
    await it.run();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      onMouseDown={onClose}
    >
      <div
        className="w-[560px] max-w-[92vw] overflow-hidden"
        style={{
          background: "var(--vf-surface)",
          border: "1px solid var(--vf-border)",
          borderRadius: "var(--vf-radius-lg)",
          boxShadow: "var(--vf-shadow-lg)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-2 px-3"
          style={{ height: 44, borderBottom: "1px solid var(--vf-border)" }}
        >
          <span style={{ color: "var(--vf-muted)" }}>
            <Icon name="search" size={15} />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={async (e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(items.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                await pick(activeIndex);
              }
            }}
            placeholder="Search titles, body, or type to create…"
            className="w-full bg-transparent text-[14px] outline-none"
            style={{ color: "var(--vf-fg)" }}
          />
          <span className="vf-kbd">Esc</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-1">
          {items.length === 0 ? (
            <div
              className="px-4 py-6 text-center text-[13px]"
              style={{ color: "var(--vf-subtle)" }}
            >
              No results.
            </div>
          ) : (
            items.map((it, i) => {
              const active = i === activeIndex;
              return (
                <button
                  key={it.id}
                  onClick={() => void pick(i)}
                  onMouseMove={() => setIndex(i)}
                  className="flex w-full items-start gap-2 rounded px-3 py-2 text-left text-[13px]"
                  style={{
                    background: active ? "var(--vf-accent-soft)" : "transparent",
                    color: "var(--vf-fg)",
                    transition: "background-color 120ms ease",
                  }}
                >
                  <span
                    className="mt-0.5"
                    style={{
                      color: active ? "var(--vf-accent)" : "var(--vf-muted)",
                    }}
                  >
                    {it.icon}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{it.label}</span>
                    {it.snippet && (
                      <span
                        className="mt-0.5 line-clamp-1 text-[11.5px]"
                        style={{ color: "var(--vf-muted)" }}
                      >
                        {it.snippet.before}
                        <mark
                          style={{
                            background: "transparent",
                            color: "var(--vf-accent)",
                            fontWeight: 600,
                          }}
                        >
                          {it.snippet.match}
                        </mark>
                        {it.snippet.after}
                      </span>
                    )}
                  </span>
                  <span
                    className="ml-2 shrink-0 text-[11px]"
                    style={{ color: "var(--vf-subtle)" }}
                  >
                    {it.hint}
                  </span>
                </button>
              );
            })
          )}
        </div>
        <div
          className="flex items-center justify-between px-3 text-[11px]"
          style={{
            height: 32,
            color: "var(--vf-subtle)",
            borderTop: "1px solid var(--vf-border)",
            background: "var(--vf-bg)",
          }}
        >
          <span>
            <span className="vf-kbd">↑</span> <span className="vf-kbd">↓</span> navigate
          </span>
          <span>
            <span className="vf-kbd">Enter</span> open
          </span>
        </div>
      </div>
    </div>
  );
}
