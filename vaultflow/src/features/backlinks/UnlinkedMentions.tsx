import { useMemo, useState } from "react";
import Icon from "../../components/Icon";
import { useVaultStore } from "../../stores/useVaultStore";
import { parseWikilinks } from "../../lib/markdown";

interface Props {
  noteId: string;
}

function findUnlinkedMentions(
  noteId: string,
  title: string,
  notes: Record<string, { id: string; title: string; content: string }>,
): { id: string; title: string; snippet: string }[] {
  if (!title.trim() || title.trim().length < 3) return [];
  const target = title.toLowerCase();
  const wordRe = new RegExp(
    `(?<![\\p{L}\\p{N}_])${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}_])`,
    "giu",
  );

  const out: { id: string; title: string; snippet: string }[] = [];
  for (const n of Object.values(notes)) {
    if (n.id === noteId) continue;
    const content = n.content;
    if (!content.toLowerCase().includes(target)) continue;

    const linked = parseWikilinks(content).some(
      (l) => l.title.toLowerCase() === target,
    );

    wordRe.lastIndex = 0;
    const m = wordRe.exec(content);
    if (!m) continue;
    const before = content.slice(Math.max(0, m.index - 4), m.index);
    if (before.endsWith("[[") && linked) continue;

    const start = Math.max(0, m.index - 30);
    const end = Math.min(content.length, m.index + m[0].length + 40);
    const snippet =
      (start > 0 ? "…" : "") +
      content.slice(start, end).replace(/\s+/g, " ").trim() +
      (end < content.length ? "…" : "");
    out.push({ id: n.id, title: n.title, snippet });
  }
  return out;
}

export default function UnlinkedMentions({ noteId }: Props) {
  const note = useVaultStore((s) => s.notes[noteId] ?? null);
  const notes = useVaultStore((s) => s.notes);
  const backlinks = useVaultStore((s) => s.linkIndex.backlinks);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const [open, setOpen] = useState(false); // collapsed by default — it's noisy

  const mentions = useMemo(() => {
    if (!note) return [];
    const linkedIds = new Set(backlinks[note.title.toLowerCase()] ?? []);
    return findUnlinkedMentions(note.id, note.title, notes).filter(
      (m) => !linkedIds.has(m.id),
    );
  }, [note, notes, backlinks]);

  if (!note || mentions.length === 0) return null;

  return (
    <div
      className="border-t"
      style={{
        borderColor: "var(--vf-border)",
        background: "var(--vf-surface-raised)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-5 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--vf-muted)" }}
      >
        <span
          className={`vf-chevron ${open ? "is-open" : ""}`}
          style={{ display: "inline-flex" }}
        >
          <Icon name="chevron-right" size={12} />
        </span>
        <Icon name="dot" size={12} />
        Unlinked mentions
        <span style={{ color: "var(--vf-subtle)" }}>({mentions.length})</span>
      </button>
      {open && (
        <div className="px-5 pb-3">
          <ul
            className="space-y-1 overflow-y-auto pr-1"
            style={{ maxHeight: 260 }}
          >
            {mentions.map((m) => (
              <li key={m.id}>
                <button
                  onClick={() => setActiveNote(m.id)}
                  className="flex w-full flex-col items-start gap-0.5 rounded px-1.5 py-1 text-left"
                  onMouseOver={(e) =>
                    (e.currentTarget.style.background = "var(--vf-surface-hover)")
                  }
                  onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span
                    className="text-[12.5px] font-medium"
                    style={{ color: "var(--vf-fg-secondary)" }}
                  >
                    {m.title}
                  </span>
                  <span
                    className="line-clamp-2 text-[11.5px]"
                    style={{ color: "var(--vf-subtle)" }}
                  >
                    {m.snippet}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
