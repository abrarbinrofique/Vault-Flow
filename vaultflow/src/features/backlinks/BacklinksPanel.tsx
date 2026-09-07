import { useMemo, useState } from "react";
import Icon from "../../components/Icon";
import { useVaultStore } from "../../stores/useVaultStore";

interface Props {
  noteId?: string | null;
}

interface SourceEntry {
  id: string;
  title: string;
  snippets: string[];
}

function extractSnippets(content: string, title: string, max = 3): string[] {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `(?<!!)\\[\\[${escaped}(?:\\|[^\\]\\n]+)?\\]\\]`,
    "gi",
  );
  const out: string[] = [];
  const seenLines = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null && out.length < max) {
    // find enclosing line
    const start = content.lastIndexOf("\n", m.index - 1) + 1;
    let end = content.indexOf("\n", m.index + m[0].length);
    if (end === -1) end = content.length;
    if (seenLines.has(start)) continue;
    seenLines.add(start);
    let line = content.slice(start, end).trim();
    if (line.length > 200) {
      const local = m.index - start;
      const from = Math.max(0, local - 60);
      const to = Math.min(line.length, local + m[0].length + 100);
      line =
        (from > 0 ? "…" : "") +
        line.slice(from, to) +
        (to < (end - start) ? "…" : "");
    }
    out.push(line);
  }
  return out;
}

export default function BacklinksPanel({ noteId }: Props = {}) {
  const resolvedId = useVaultStore((s) =>
    noteId !== undefined ? noteId : s.activeNoteId,
  );
  const note = useVaultStore((s) => (resolvedId ? s.notes[resolvedId] : null));
  const backlinks = useVaultStore((s) => s.linkIndex.backlinks);
  const notes = useVaultStore((s) => s.notes);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const [open, setOpen] = useState(true);

  const sources: SourceEntry[] = useMemo(() => {
    if (!note) return [];
    const ids = backlinks[note.title.toLowerCase()] ?? [];
    const uniq = new Set<string>();
    const out: SourceEntry[] = [];
    for (const id of ids) {
      if (id === note.id) continue;
      if (uniq.has(id)) continue;
      const src = notes[id];
      if (!src) continue;
      uniq.add(id);
      out.push({
        id,
        title: src.title,
        snippets: extractSnippets(src.content, note.title),
      });
    }
    return out;
  }, [note, notes, backlinks]);

  if (!note) return null;

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
        <Icon name="link" size={12} />
        Linked mentions
        <span style={{ color: "var(--vf-subtle)" }}>({sources.length})</span>
      </button>
      {open && (
        <div className="px-5 pb-3">
          {sources.length === 0 ? (
            <div className="text-[12px]" style={{ color: "var(--vf-subtle)" }}>
              No notes link here yet.
            </div>
          ) : (
            <ul
              className="space-y-2 overflow-y-auto pr-1"
              style={{ maxHeight: 320 }}
            >
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="overflow-hidden rounded"
                  style={{
                    background: "var(--vf-surface)",
                    border: "1px solid var(--vf-border)",
                  }}
                >
                  <button
                    onClick={() => setActiveNote(s.id)}
                    className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left"
                    onMouseOver={(e) =>
                      (e.currentTarget.style.background = "var(--vf-surface-hover)")
                    }
                    onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <Icon name="file" size={12} />
                    <span
                      className="text-[12.5px] font-medium"
                      style={{ color: "var(--vf-fg)" }}
                    >
                      {s.title}
                    </span>
                    <span
                      className="ml-auto text-[10.5px]"
                      style={{ color: "var(--vf-subtle)" }}
                    >
                      {s.snippets.length}{" "}
                      {s.snippets.length === 1 ? "mention" : "mentions"}
                    </span>
                  </button>
                  {s.snippets.length > 0 && (
                    <div
                      className="px-3 pb-2 pt-1"
                      style={{ borderTop: "1px solid var(--vf-border)" }}
                    >
                      {s.snippets.map((snip, i) => (
                        <div
                          key={i}
                          className="mt-1 border-l-2 pl-2 text-[12px] leading-snug first:mt-0"
                          style={{
                            color: "var(--vf-fg-secondary)",
                            borderColor: "var(--vf-accent-tint)",
                          }}
                        >
                          {snip}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
