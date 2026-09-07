import { useEffect, useRef, useState } from "react";
import Editor from "./Editor";
import BacklinksPanel from "../backlinks/BacklinksPanel";
import UnlinkedMentions from "../backlinks/UnlinkedMentions";
import Icon from "../../components/Icon";
import { useVaultStore } from "../../stores/useVaultStore";

interface Props {
  noteId: string;
  showBacklinks?: boolean;
  actions?: React.ReactNode;
}

type SaveState = "idle" | "saving" | "saved";

export default function NotePane({ noteId, showBacklinks = true, actions }: Props) {
  const note = useVaultStore((s) => s.notes[noteId] ?? null);
  const updatedAt = note?.updatedAt ?? 0;
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const firstMount = useRef(true);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (firstMount.current) {
      firstMount.current = false;
      return;
    }
    setSaveState("saved");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaveState("idle"), 1400);
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [updatedAt]);

  if (!note) {
    return (
      <div
        className="flex h-full items-center justify-center text-sm"
        style={{ color: "var(--vf-muted)" }}
      >
        Note not found.
      </div>
    );
  }

  const pathParts = note.path ? note.path.split("/").filter(Boolean) : [];

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b px-4"
        style={{
          borderColor: "var(--vf-border)",
          background: "var(--vf-topbar)",
          height: 44,
        }}
      >
        <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
          {pathParts.map((p, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span style={{ color: "var(--vf-muted)" }}>{p}</span>
              <span style={{ color: "var(--vf-subtle)" }}>/</span>
            </span>
          ))}
          <span
            className="truncate font-medium"
            style={{ color: "var(--vf-fg)" }}
          >
            {note.title}
          </span>
          <span
            className="ml-2 flex items-center gap-1 text-[11px]"
            style={{
              color:
                saveState === "saved"
                  ? "var(--vf-accent)"
                  : "var(--vf-subtle)",
              opacity: saveState === "idle" ? 0 : 1,
              transition: "opacity 200ms ease, color 200ms ease",
            }}
            aria-live="polite"
          >
            <Icon name="check" size={12} />
            Saved
          </span>
        </div>
        <div className="flex items-center gap-1">{actions}</div>
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
