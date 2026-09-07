import { useMemo } from "react";
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
  if (!title.trim()) return [];
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

    // Skip if this note's linked wikilinks already include the title (i.e., it's a real backlink).
    const linked = parseWikilinks(content).some(
      (l) => l.title.toLowerCase() === target,
    );

    wordRe.lastIndex = 0;
    const m = wordRe.exec(content);
    if (!m) continue;
    // If the match sits inside a wikilink, don't call it unlinked. Cheap check:
    // scan backwards for "[[" before the match and forward for "]]" before another "[[".
    const before = content.slice(Math.max(0, m.index - 4), m.index);
    if (before.endsWith("[[")) {
      if (linked) continue;
    }

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
      className="border-t px-4 py-2 text-xs"
      style={{ borderColor: "var(--vf-border)", background: "var(--vf-panel)" }}
    >
      <div className="mb-1 font-semibold uppercase tracking-wide opacity-70">
        Unlinked mentions ({mentions.length})
      </div>
      <ul className="space-y-1">
        {mentions.map((m) => (
          <li key={m.id}>
            <button
              onClick={() => setActiveNote(m.id)}
              className="text-left hover:opacity-80"
            >
              <span className="underline decoration-dotted">{m.title}</span>
              <span className="ml-2 opacity-60">{m.snippet}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
