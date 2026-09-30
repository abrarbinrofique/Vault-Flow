import { useEffect, useRef, useState } from "react";
import Icon from "../../components/Icon";
import { useVaultStore } from "../../stores/useVaultStore";
import type { NoteKind } from "../../types";

type Kind = NoteKind;

export default function NewNoteMenu() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("markdown");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setKind("markdown");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const create = async () => {
    const t = title.trim();
    if (!t) return;
    setOpen(false);
    await useVaultStore.getState().createNote({ title: t, kind });
  };

  return (
    <div className="relative">
      <button
        className="vf-btn vf-btn-primary"
        onClick={() => setOpen((v) => !v)}
        style={{ height: 26, padding: "0 8px", fontSize: 12 }}
        aria-label="New note / drawing / sheet"
      >
        <Icon name="plus" size={13} />
        New
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 z-50 mt-1 overflow-hidden vf-panel"
            style={{
              boxShadow: "var(--vf-shadow-md)",
              background: "var(--vf-surface)",
              minWidth: 260,
              padding: 10,
            }}
          >
            <label
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--vf-muted)" }}
            >
              Title
            </label>
            <input
              ref={inputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void create();
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder={
                kind === "drawing"
                  ? "e.g. System diagram"
                  : kind === "sheet"
                    ? "e.g. Sales tracker"
                    : "e.g. Weekly review"
              }
              className="w-full rounded px-2 py-1.5 text-[13px] outline-none"
              style={{
                background: "var(--vf-bg)",
                color: "var(--vf-fg)",
                border: "1px solid var(--vf-border)",
              }}
            />

            <div
              className="mt-2.5 mb-1 block text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--vf-muted)" }}
            >
              Type
            </div>
            <div className="flex gap-1">
              <TypePill
                active={kind === "markdown"}
                onClick={() => {
                  setKind("markdown");
                  inputRef.current?.focus();
                }}
                icon={<Icon name="file" size={12} />}
                label="Note"
              />
              <TypePill
                active={kind === "drawing"}
                onClick={() => {
                  setKind("drawing");
                  inputRef.current?.focus();
                }}
                icon={<Icon name="pen" size={12} />}
                label="Drawing"
              />
              <TypePill
                active={kind === "sheet"}
                onClick={() => {
                  setKind("sheet");
                  inputRef.current?.focus();
                }}
                icon={<Icon name="grid" size={12} />}
                label="Sheet"
              />
            </div>

            <div className="mt-3 flex items-center justify-end gap-1.5">
              <button
                className="vf-btn"
                onClick={() => setOpen(false)}
                style={{ height: 26, fontSize: 12 }}
              >
                Cancel
              </button>
              <button
                className="vf-btn vf-btn-primary"
                onClick={() => void create()}
                disabled={!title.trim()}
                style={{
                  height: 26,
                  fontSize: 12,
                  opacity: title.trim() ? 1 : 0.5,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TypePill({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1 rounded text-[11.5px]"
      style={{
        height: 26,
        background: active ? "var(--vf-accent)" : "var(--vf-bg)",
        color: active ? "var(--vf-on-accent)" : "var(--vf-fg-secondary)",
        border: "1px solid",
        borderColor: active ? "transparent" : "var(--vf-border)",
        transition: "background-color 120ms ease, color 120ms ease",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
