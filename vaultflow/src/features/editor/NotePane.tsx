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

function CopyNoteButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="vf-icon-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(content);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* ignore */
        }
      }}
      aria-label="Copy full note to clipboard"
      title={copied ? "Copied" : "Copy note"}
      style={{ color: copied ? "var(--vf-accent)" : undefined }}
    >
      {copied ? (
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
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
        <div className="flex items-center gap-1">
          <CopyNoteButton content={note.content} />
          {actions}
        </div>
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
