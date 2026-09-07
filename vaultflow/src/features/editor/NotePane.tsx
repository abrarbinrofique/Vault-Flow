import Editor from "./Editor";
import BacklinksPanel from "../backlinks/BacklinksPanel";
import UnlinkedMentions from "../backlinks/UnlinkedMentions";
import { useVaultStore } from "../../stores/useVaultStore";

interface Props {
  noteId: string;
  showBacklinks?: boolean;
  right?: React.ReactNode;
}

export default function NotePane({ noteId, showBacklinks = true, right }: Props) {
  const note = useVaultStore((s) => s.notes[noteId] ?? null);

  if (!note) {
    return (
      <div className="flex h-full items-center justify-center text-sm opacity-60">
        Note not found.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b px-4 py-2 text-sm"
        style={{ borderColor: "var(--vf-border)" }}
      >
        <span className="truncate">{note.title}</span>
        {right}
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor noteId={note.id} initialContent={note.content} />
      </div>
      {showBacklinks && (
        <>
          <BacklinksPanel noteId={note.id} />
          <UnlinkedMentions noteId={note.id} />
        </>
      )}
    </div>
  );
}
