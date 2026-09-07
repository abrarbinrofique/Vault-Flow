import { useEffect, useRef, useState } from "react";
import Editor from "./Editor";
import TableToolbar from "./TableToolbar";
import { allEditors } from "./focusedEditor";
import BacklinksPanel from "../backlinks/BacklinksPanel";
import UnlinkedMentions from "../backlinks/UnlinkedMentions";
import Icon from "../../components/Icon";
import { useVaultStore } from "../../stores/useVaultStore";
import { noteToHtml, noteToMarkdown } from "../../lib/exportNote";
import { triggerDownload } from "../../lib/vaultZip";
import type { Note } from "../../types";

interface Props {
  noteId: string;
  showBacklinks?: boolean;
  actions?: React.ReactNode;
}

function TableToolbarHost() {
  const [views, setViews] = useState(() => allEditors());
  useEffect(() => {
    // Poll the registry once per second; also update on visibility events.
    const id = setInterval(() => setViews(allEditors()), 500);
    return () => clearInterval(id);
  }, []);
  return <TableToolbar views={views} />;
}

function NoteMenu({ note }: { note: Note }) {
  const [open, setOpen] = useState(false);
  const exportMd = () => {
    const { blob, filename } = noteToMarkdown(note);
    triggerDownload(blob, filename);
  };
  const exportHtml = () => {
    const { blob, filename } = noteToHtml(note);
    triggerDownload(blob, filename);
  };
  return (
    <div className="relative">
      <button
        className="vf-icon-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Note actions"
        title="Note actions"
      >
        <Icon name="more" size={14} />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 z-50 mt-1 min-w-[180px] overflow-hidden vf-panel"
            style={{
              boxShadow: "var(--vf-shadow-md)",
              background: "var(--vf-surface)",
            }}
          >
            <button
              onClick={() => {
                setOpen(false);
                exportMd();
              }}
              className="flex w-full items-center gap-2 px-3 text-left text-[12.5px]"
              style={{ height: 30, color: "var(--vf-fg-secondary)" }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = "var(--vf-surface-hover)")
              }
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="file" size={13} />
              Export as Markdown
            </button>
            <button
              onClick={() => {
                setOpen(false);
                exportHtml();
              }}
              className="flex w-full items-center gap-2 px-3 text-left text-[12.5px]"
              style={{ height: 30, color: "var(--vf-fg-secondary)" }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = "var(--vf-surface-hover)")
              }
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="file" size={13} />
              Export as HTML
            </button>
          </div>
        </>
      )}
    </div>
  );
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
          <NoteMenu note={note} />
          {actions}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor noteId={note.id} initialContent={note.content} />
        <TableToolbarHost />
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
