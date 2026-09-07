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
      className="border-t px-4 py-2 text-xs"
      style={{ borderColor: "var(--vf-border)", background: "var(--vf-panel)" }}
    >
      <div className="mb-1 font-semibold uppercase tracking-wide opacity-70">
        Backlinks ({sourceIds.length})
      </div>
      {sourceIds.length === 0 ? (
        <div className="opacity-50">No backlinks.</div>
      ) : (
        <ul className="space-y-1">
          {sourceIds.map((id) => (
            <li key={id}>
              <button
                className="text-left underline decoration-dotted hover:opacity-80"
                onClick={() => setActiveNote(id)}
              >
                {notes[id].title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
