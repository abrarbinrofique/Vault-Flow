import Icon from "../../components/Icon";
import { useVaultStore } from "../../stores/useVaultStore";

interface Props {
  noteId?: string | null;
}

export default function BacklinksPanel({ noteId }: Props = {}) {
  const resolvedId = useVaultStore((s) =>
    noteId !== undefined ? noteId : s.activeNoteId,
  );
  const note = useVaultStore((s) => (resolvedId ? s.notes[resolvedId] : null));
  const backlinks = useVaultStore((s) => s.linkIndex.backlinks);
  const notes = useVaultStore((s) => s.notes);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);

  if (!note) return null;

  const sourceIds = (backlinks[note.title.toLowerCase()] ?? []).filter(
    (id) => id !== note.id && notes[id],
  );

  return (
    <div
      className="border-t px-5 py-3"
      style={{
        borderColor: "var(--vf-border)",
        background: "var(--vf-surface)",
      }}
    >
      <div
        className="mb-2 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--vf-muted)" }}
      >
        <Icon name="link" size={12} />
        Backlinks
        <span style={{ color: "var(--vf-subtle)" }}>({sourceIds.length})</span>
      </div>
      {sourceIds.length === 0 ? (
        <div className="text-[12px]" style={{ color: "var(--vf-subtle)" }}>
          No notes link here yet.
        </div>
      ) : (
        <ul className="space-y-0.5">
          {sourceIds.map((id) => (
            <li key={id}>
              <button
                onClick={() => setActiveNote(id)}
                className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[12.5px]"
                style={{ color: "var(--vf-fg-secondary)" }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "var(--vf-surface-hover)")
                }
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Icon name="file" size={12} />
                {notes[id].title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
