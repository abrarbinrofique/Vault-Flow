import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../../components/Icon";
import { searchNotes, useVaultStore } from "../../stores/useVaultStore";
import { openDailyNote } from "../dailynotes/openDailyNote";

interface Item {
  kind: "note" | "command";
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
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

    const builtins: Item[] = [
      {
        kind: "command",
        id: "cmd:daily",
        label: "Open today's daily note",
        hint: "Command",
        icon: <Icon name="calendar" size={14} />,
        run: () => openDailyNote(),
      },
    ];

    if (q) {
      const ql = q.toLowerCase();
      for (const b of builtins) if (b.label.toLowerCase().includes(ql)) out.push(b);
      const hits = searchNotes(q, 20);
      for (const h of hits) {
        out.push({
          kind: "note",
          id: h.id,
          label: h.title,
          hint: "Note",
          icon: <Icon name="file" size={14} />,
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
                await pick(index);
              }
            }}
            placeholder="Search notes or type to create…"
            className="w-full bg-transparent text-[14px] outline-none"
            style={{ color: "var(--vf-fg)" }}
          />
          <span className="vf-kbd">Esc</span>
        </div>
        <div className="max-h-[360px] overflow-y-auto p-1">
          {items.length === 0 ? (
            <div
              className="px-4 py-6 text-center text-[13px]"
              style={{ color: "var(--vf-subtle)" }}
            >
              No results.
            </div>
          ) : (
            items.map((it, i) => {
              const active = i === index;
              return (
                <button
                  key={it.id}
                  onClick={() => void pick(i)}
                  onMouseMove={() => setIndex(i)}
                  className="flex w-full items-center gap-2 rounded px-3 text-left text-[13px]"
                  style={{
                    height: 34,
                    background: active ? "var(--vf-accent-soft)" : "transparent",
                    color: "var(--vf-fg)",
                    transition: "background-color 120ms ease",
                  }}
                >
                  <span
                    style={{
                      color: active ? "var(--vf-accent)" : "var(--vf-muted)",
                    }}
                  >
                    {it.icon}
                  </span>
                  <span className="flex-1 truncate">{it.label}</span>
                  <span
                    className="text-[11px]"
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
