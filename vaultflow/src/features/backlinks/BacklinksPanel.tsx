import { useVaultStore } from "../../stores/useVaultStore";

export default function BacklinksPanel() {
  const activeNote = useVaultStore((s) =>
    s.activeNoteId ? s.notes[s.activeNoteId] : null,
  );
  const backlinks = useVaultStore((s) => s.linkIndex.backlinks);
  const notes = useVaultStore((s) => s.notes);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);

  if (!activeNote) return null;

  const sourceIds = (backlinks[activeNote.title.toLowerCase()] ?? []).filter(
    (id) => id !== activeNote.id && notes[id],
  );

  return (
    <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
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
