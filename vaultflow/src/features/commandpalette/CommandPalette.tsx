import { useEffect, useMemo, useRef, useState } from "react";
import { searchNotes, useVaultStore } from "../../stores/useVaultStore";

interface Item {
  kind: "note" | "command";
  id: string;
  label: string;
  hint?: string;
  run: () => void | Promise<void>;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const createNote = useVaultStore((s) => s.createNote);
  const notes = useVaultStore((s) => s.notes);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    if (!open) return [];
    const q = query.trim();
    const out: Item[] = [];

    if (q) {
      const hits = searchNotes(q, 20);
      for (const h of hits) {
        out.push({
          kind: "note",
          id: h.id,
          label: h.title,
          hint: "open",
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
          hint: "new",
          run: async () => {
            await createNote({ title: q });
          },
        });
      }
    } else {
      const recent = Object.values(notes)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 20);
      for (const n of recent) {
        out.push({
          kind: "note",
          id: n.id,
          label: n.title,
          hint: "recent",
          run: () => setActiveNote(n.id),
        });
      }
    }
    return out;
  }, [open, query, notes, setActiveNote, createNote]);

  useEffect(() => {
    if (index >= items.length) setIndex(Math.max(0, items.length - 1));
  }, [items, index]);

  if (!open) return null;

  const pick = async (i: number) => {
    const it = items[i];
    if (!it) return;
    await it.run();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onMouseDown={onClose}
    >
      <div
        className="w-[520px] rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={async (e) => {
            if (e.key === "Escape") {
              onClose();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(items.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              await pick(index);
            }
          }}
          placeholder="Search notes or type to create…"
          className="w-full rounded-t-lg bg-transparent px-4 py-3 text-sm outline-none"
        />
        <div className="max-h-80 overflow-y-auto border-t border-neutral-200 dark:border-neutral-700">
          {items.length === 0 ? (
            <div className="px-4 py-3 text-sm opacity-60">No results.</div>
          ) : (
            items.map((it, i) => (
              <button
                key={it.id}
                onClick={() => void pick(i)}
                onMouseMove={() => setIndex(i)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm ${
                  i === index
                    ? "bg-blue-100 dark:bg-blue-900/40"
                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="truncate">{it.label}</span>
                <span className="text-xs opacity-50">{it.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
