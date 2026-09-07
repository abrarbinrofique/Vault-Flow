import { useMemo, useState } from "react";
import Icon from "../../components/Icon";
import { useSmartStore } from "../../stores/useSmartStore";
import { searchNotes, useVaultStore } from "../../stores/useVaultStore";
import {
  evaluateSmartFolder,
  type SmartFolder,
} from "../../lib/smartFolders";
import { confirmDialog, promptText } from "../../components/dialog";

async function editFolderPrompt(
  prev?: Partial<SmartFolder>,
): Promise<Partial<SmartFolder> | null> {
  const name = await promptText({
    title: prev ? "Edit smart folder" : "New smart folder",
    label: "Name",
    initialValue: prev?.name ?? "",
    submitLabel: "Next",
  });
  if (!name) return null;
  const query = await promptText({
    title: "Search query",
    label: "MiniSearch matches title + body (optional)",
    initialValue: prev?.query ?? "",
    placeholder: "e.g. project alpha",
    submitLabel: "Next",
  });
  if (query === null) return null;
  const tags = await promptText({
    title: "Tag filter",
    label: "Comma-separated, without #; must have ALL listed tags",
    initialValue: prev?.tags?.join(", ") ?? "",
    placeholder: "todo, priority",
    submitLabel: "Next",
  });
  if (tags === null) return null;
  const daysStr = await promptText({
    title: "Modified within last N days",
    label: "Blank for any",
    initialValue: prev?.modifiedWithinDays ? String(prev.modifiedWithinDays) : "",
    placeholder: "7",
    submitLabel: "Save",
  });
  if (daysStr === null) return null;

  const parsedTags = tags
    .split(",")
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean);
  const parsedDays = daysStr.trim() ? Number(daysStr) : undefined;

  return {
    name,
    query: query.trim() || undefined,
    tags: parsedTags.length ? parsedTags : undefined,
    modifiedWithinDays:
      parsedDays && !Number.isNaN(parsedDays) ? parsedDays : undefined,
  };
}

function SmartFolderRow({ folder }: { folder: SmartFolder }) {
  const [open, setOpen] = useState(false);
  const notes = useVaultStore((s) => s.notes);
  const linkIndex = useVaultStore((s) => s.linkIndex);
  const activeNoteId = useVaultStore((s) => s.activeNoteId);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const update = useSmartStore((s) => s.update);
  const remove = useSmartStore((s) => s.remove);
  const [menuOpen, setMenuOpen] = useState(false);

  const matched = useMemo(() => {
    if (!open) return [];
    return evaluateSmartFolder(folder, notes, linkIndex, (q, limit) =>
      searchNotes(q, limit),
    );
  }, [open, folder, notes, linkIndex]);

  return (
    <div>
      <div
        className="group flex items-center pr-1"
        style={{
          height: 28,
          paddingLeft: 8,
          background: "transparent",
          color: "var(--vf-fg-secondary)",
          cursor: "pointer",
        }}
        onClick={() => setOpen((v) => !v)}
        onMouseOver={(e) =>
          (e.currentTarget.style.background = "var(--vf-surface-hover)")
        }
        onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
          <span
            className={`vf-chevron ${open ? "is-open" : ""}`}
            style={{ color: "var(--vf-subtle)", display: "inline-flex" }}
          >
            <Icon name="chevron-right" size={14} />
          </span>
          <span style={{ color: "var(--vf-accent)", display: "inline-flex" }}>
            <Icon name="search" size={13} />
          </span>
          <span className="truncate font-medium">{folder.name}</span>
        </span>
        <div className="relative opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className="vf-icon-btn"
            style={{ width: 22, height: 22 }}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            aria-label="Smart folder actions"
          >
            <Icon name="more" size={14} />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <div
                className="absolute right-0 z-50 mt-1 min-w-[160px] overflow-hidden vf-panel"
                style={{
                  boxShadow: "var(--vf-shadow-md)",
                  background: "var(--vf-surface)",
                }}
              >
                <button
                  className="flex w-full items-center gap-2 px-3 text-left text-[12.5px]"
                  style={{ height: 28, color: "var(--vf-fg-secondary)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    void (async () => {
                      const name = await promptText({
                        title: "Rename smart folder",
                        label: "Name",
                        initialValue: folder.name,
                        submitLabel: "Rename",
                      });
                      if (name && name !== folder.name)
                        await update(folder.id, { name });
                    })();
                  }}
                >
                  <Icon name="edit" size={13} /> Rename
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 text-left text-[12.5px]"
                  style={{ height: 28, color: "var(--vf-fg-secondary)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    void (async () => {
                      const patch = await editFolderPrompt(folder);
                      if (patch) await update(folder.id, patch);
                    })();
                  }}
                >
                  <Icon name="search" size={13} /> Edit filters
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 text-left text-[12.5px]"
                  style={{ height: 28, color: "#e11d48" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    void (async () => {
                      const ok = await confirmDialog({
                        title: `Delete smart folder "${folder.name}"?`,
                        danger: true,
                      });
                      if (ok) await remove(folder.id);
                    })();
                  }}
                >
                  <Icon name="trash" size={13} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {open && (
        <>
          {matched.length === 0 ? (
            <div
              className="px-3 py-1 text-[11.5px]"
              style={{ paddingLeft: 32, color: "var(--vf-subtle)" }}
            >
              No matches.
            </div>
          ) : (
            matched.map((n) => {
              const active = activeNoteId === n.id;
              return (
                <div
                  key={n.id}
                  className="group flex items-center pr-1"
                  style={{
                    height: 26,
                    paddingLeft: 32,
                    cursor: "pointer",
                    color: active ? "var(--vf-fg)" : "var(--vf-fg-secondary)",
                    background: active ? "var(--vf-accent-soft)" : "transparent",
                    borderLeft: active
                      ? "2px solid var(--vf-accent)"
                      : "2px solid transparent",
                  }}
                  onClick={() => setActiveNote(n.id)}
                  onMouseOver={(e) => {
                    if (!active)
                      e.currentTarget.style.background = "var(--vf-surface-hover)";
                  }}
                  onMouseOut={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
                    <span
                      style={{
                        color: active ? "var(--vf-accent)" : "var(--vf-subtle)",
                        display: "inline-flex",
                      }}
                    >
                      <Icon name="file" size={12} />
                    </span>
                    <span className="truncate">{n.title}</span>
                  </span>
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}

export default function SmartSection() {
  const folders = useSmartStore((s) => s.folders);
  const loaded = useSmartStore((s) => s.loaded);
  const add = useSmartStore((s) => s.add);

  const onAdd = async () => {
    const draft = await editFolderPrompt();
    if (!draft || !draft.name) return;
    await add(draft as Omit<SmartFolder, "id">);
  };

  if (!loaded) return null;

  return (
    <div className="border-b" style={{ borderColor: "var(--vf-border)" }}>
      <div
        className="flex items-center justify-between px-3 pt-3 pb-1"
        style={{ color: "var(--vf-muted)" }}
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-wider">
          Smart
        </span>
        <button
          onClick={() => void onAdd()}
          className="text-[11px]"
          style={{ color: "var(--vf-accent)" }}
          aria-label="New smart folder"
          title="New smart folder"
        >
          + New
        </button>
      </div>
      {folders.length === 0 ? (
        <div
          className="px-3 pb-2 text-[11.5px]"
          style={{ color: "var(--vf-subtle)" }}
        >
          No smart folders yet.
        </div>
      ) : (
        <div className="pb-1">
          {folders.map((f) => (
            <SmartFolderRow key={f.id} folder={f} />
          ))}
        </div>
      )}
    </div>
  );
}
