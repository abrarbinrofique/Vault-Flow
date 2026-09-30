import { useState } from "react";
import Icon from "../../components/Icon";
import { useVaultStore } from "../../stores/useVaultStore";
import { openDailyNote } from "../dailynotes/openDailyNote";
import type { NoteKind } from "../../types";

export default function EmptyState() {
  const createNote = useVaultStore((s) => s.createNote);
  const [showPicker, setShowPicker] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<NoteKind>("markdown");

  const create = async () => {
    const t = title.trim();
    if (!t) return;
    setShowPicker(false);
    setTitle("");
    await createNote({ title: t, kind });
  };

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background: "var(--vf-accent-soft)",
            color: "var(--vf-accent)",
          }}
        >
          <Icon name="file" size={26} />
        </div>
        <h1
          className="mb-1 text-[18px] font-semibold tracking-tight"
          style={{ color: "var(--vf-fg)" }}
        >
          Welcome to VaultFlow
        </h1>
        <p className="mb-6 text-[13px]" style={{ color: "var(--vf-muted)" }}>
          Your local-first, offline-capable knowledge base. Start with a fresh
          note, drawing or sheet — or open today's daily note.
        </p>

        {!showPicker ? (
          <div className="flex items-center justify-center gap-2">
            <button
              className="vf-btn vf-btn-primary"
              onClick={() => {
                setShowPicker(true);
                setTitle("");
                setKind("markdown");
              }}
            >
              <Icon name="plus" size={14} />
              New
            </button>
            <button className="vf-btn" onClick={() => void openDailyNote()}>
              <Icon name="calendar" size={14} />
              Today's daily note
            </button>
          </div>
        ) : (
          <div
            className="mx-auto max-w-sm text-left"
            style={{
              background: "var(--vf-surface)",
              border: "1px solid var(--vf-border)",
              borderRadius: "var(--vf-radius-lg)",
              padding: 14,
            }}
          >
            <label
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--vf-muted)" }}
            >
              Title
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void create();
                } else if (e.key === "Escape") {
                  setShowPicker(false);
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
                onClick={() => setKind("markdown")}
                icon={<Icon name="file" size={12} />}
                label="Note"
              />
              <TypePill
                active={kind === "drawing"}
                onClick={() => setKind("drawing")}
                icon={<Icon name="pen" size={12} />}
                label="Drawing"
              />
              <TypePill
                active={kind === "sheet"}
                onClick={() => setKind("sheet")}
                icon={<Icon name="grid" size={12} />}
                label="Sheet"
              />
            </div>

            <div className="mt-3 flex items-center justify-end gap-1.5">
              <button
                className="vf-btn"
                onClick={() => setShowPicker(false)}
                style={{ height: 28, fontSize: 12 }}
              >
                Cancel
              </button>
              <button
                className="vf-btn vf-btn-primary"
                onClick={() => void create()}
                disabled={!title.trim()}
                style={{
                  height: 28,
                  fontSize: 12,
                  opacity: title.trim() ? 1 : 0.5,
                }}
              >
                Create
              </button>
            </div>
          </div>
        )}

        <div
          className="mt-6 text-[11.5px]"
          style={{ color: "var(--vf-subtle)" }}
        >
          <span className="vf-kbd">Ctrl</span> +{" "}
          <span className="vf-kbd">P</span> to search &middot;{" "}
          <span className="vf-kbd">Ctrl</span> +{" "}
          <span className="vf-kbd">\</span> to toggle sidebar
        </div>
      </div>
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
        height: 28,
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
