import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useVaultStore } from "../../stores/useVaultStore";
import { useUiStore } from "../../stores/useUiStore";
import Icon from "../../components/Icon";
import type { Folder, Note } from "../../types";

interface TreeNode {
  path: string;
  name: string;
  folders: TreeNode[];
  notes: Note[];
}

function buildTree(folders: Folder[], notes: Note[]): TreeNode {
  const root: TreeNode = { path: "", name: "", folders: [], notes: [] };
  const map = new Map<string, TreeNode>();
  map.set("", root);

  const sortedFolders = [...folders].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sortedFolders) {
    const node: TreeNode = { path: f.path, name: f.name, folders: [], notes: [] };
    map.set(f.path, node);
    const parentPath = f.path.includes("/")
      ? f.path.slice(0, f.path.lastIndexOf("/"))
      : "";
    const parent = map.get(parentPath) ?? root;
    parent.folders.push(node);
  }

  for (const n of notes) {
    const parent = map.get(n.path) ?? root;
    parent.notes.push(n);
  }

  for (const node of map.values()) {
    node.notes.sort((a, b) => a.title.localeCompare(b.title));
    node.folders.sort((a, b) => a.name.localeCompare(b.name));
  }
  return root;
}

function useTreeActions() {
  return useVaultStore(
    useShallow((s) => ({
      activeNoteId: s.activeNoteId,
      setActiveNote: s.setActiveNote,
      createNote: s.createNote,
      createFolder: s.createFolder,
      renameNote: s.renameNote,
      deleteNote: s.deleteNote,
      renameFolder: s.renameFolder,
      deleteFolder: s.deleteFolder,
    })),
  );
}

function RowShell({
  depth,
  active = false,
  onClick,
  children,
  menu,
}: {
  depth: number;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  menu?: React.ReactNode;
}) {
  return (
    <div
      className="group relative flex items-center pr-1"
      style={{
        height: 28,
        paddingLeft: 8 + depth * 12,
        background: active ? "var(--vf-accent-soft)" : "transparent",
        color: active ? "var(--vf-fg)" : "var(--vf-fg-secondary)",
        cursor: onClick ? "pointer" : "default",
        borderLeft: active
          ? "2px solid var(--vf-accent)"
          : "2px solid transparent",
        transition: "background-color 120ms ease, color 120ms ease",
      }}
      onClick={onClick}
      onMouseOver={(e) => {
        if (!active) e.currentTarget.style.background = "var(--vf-surface-hover)";
      }}
      onMouseOut={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px]">
        {children}
      </div>
      {menu && (
        <div className="opacity-0 transition-opacity group-hover:opacity-100">
          {menu}
        </div>
      )}
    </div>
  );
}

function KebabMenu({
  items,
}: {
  items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        className="vf-icon-btn"
        style={{ width: 22, height: 22 }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="More actions"
      >
        <Icon name="more" size={14} />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div
            className="absolute right-0 z-50 mt-1 min-w-[140px] overflow-hidden vf-panel"
            style={{
              boxShadow: "var(--vf-shadow-md)",
              background: "var(--vf-surface)",
            }}
          >
            {items.map((it, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  it.onClick();
                }}
                className="flex w-full items-center gap-2 px-3 text-left text-[12.5px]"
                style={{
                  height: 28,
                  color: it.danger ? "#e11d48" : "var(--vf-fg-secondary)",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "var(--vf-surface-hover)")
                }
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ opacity: 0.8 }}>{it.icon}</span>
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FolderRow({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const actions = useTreeActions();

  return (
    <RowShell
      depth={depth}
      onClick={onToggle}
      menu={
        <KebabMenu
          items={[
            {
              label: "New note",
              icon: <Icon name="plus" size={13} />,
              onClick: async () => {
                const t = window.prompt("New note title");
                if (t) await actions.createNote({ title: t, path: node.path });
              },
            },
            {
              label: "New folder",
              icon: <Icon name="folder" size={13} />,
              onClick: async () => {
                const n = window.prompt("New folder name");
                if (n) await actions.createFolder(n, node.path);
              },
            },
            {
              label: "Rename",
              icon: <Icon name="edit" size={13} />,
              onClick: async () => {
                const n = window.prompt("Rename folder", node.name);
                if (n && n !== node.name) await actions.renameFolder(node.path, n);
              },
            },
            {
              label: "Delete",
              icon: <Icon name="trash" size={13} />,
              danger: true,
              onClick: async () => {
                if (window.confirm(`Delete folder "${node.name}" and all its notes?`))
                  await actions.deleteFolder(node.path);
              },
            },
          ]}
        />
      }
    >
      <span
        className={`vf-chevron ${expanded ? "is-open" : ""}`}
        style={{ color: "var(--vf-subtle)", display: "inline-flex" }}
      >
        <Icon name="chevron-right" size={14} />
      </span>
      <span style={{ color: "var(--vf-muted)", display: "inline-flex" }}>
        <Icon name="folder" size={14} />
      </span>
      <span className="truncate font-medium">{node.name}</span>
    </RowShell>
  );
}

function NoteRow({ note, depth }: { note: Note; depth: number }) {
  const actions = useTreeActions();
  const active = actions.activeNoteId === note.id;

  return (
    <RowShell
      depth={depth}
      active={active}
      onClick={() => actions.setActiveNote(note.id)}
      menu={
        <KebabMenu
          items={[
            {
              label: "Rename",
              icon: <Icon name="edit" size={13} />,
              onClick: async () => {
                const n = window.prompt("Rename note", note.title);
                if (n && n !== note.title) await actions.renameNote(note.id, n);
              },
            },
            {
              label: "Delete",
              icon: <Icon name="trash" size={13} />,
              danger: true,
              onClick: async () => {
                if (window.confirm(`Delete "${note.title}"?`))
                  await actions.deleteNote(note.id);
              },
            },
          ]}
        />
      }
    >
      <span style={{ width: 14 }} />
      <span
        style={{
          color: active ? "var(--vf-accent)" : "var(--vf-subtle)",
          display: "inline-flex",
        }}
      >
        <Icon name={note.kind === "drawing" ? "pen" : "file"} size={14} />
      </span>
      <span className="truncate">{note.title}</span>
    </RowShell>
  );
}

function TreeBody({
  node,
  depth,
  expanded,
  onToggleFolder,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggleFolder: (path: string) => void;
}) {
  return (
    <>
      {node.folders.map((child) => {
        const isOpen = expanded.has(child.path);
        return (
          <div key={child.path}>
            <FolderRow
              node={child}
              depth={depth}
              expanded={isOpen}
              onToggle={() => onToggleFolder(child.path)}
            />
            {isOpen && (
              <TreeBody
                node={child}
                depth={depth + 1}
                expanded={expanded}
                onToggleFolder={onToggleFolder}
              />
            )}
          </div>
        );
      })}
      {node.notes.map((note) => (
        <NoteRow key={note.id} note={note} depth={depth} />
      ))}
    </>
  );
}

export default function FileTree() {
  const notes = useVaultStore((s) => s.notes);
  const folders = useVaultStore((s) => s.folders);
  const tagFilter = useUiStore((s) => s.tagFilter);
  const tagIds = useVaultStore((s) =>
    tagFilter ? s.linkIndex.tags[tagFilter] : null,
  );

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleFolder = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const filteredNotes = useMemo(() => {
    if (!tagFilter || !tagIds) return notes;
    const allow = new Set(tagIds);
    const out: Record<string, Note> = {};
    for (const [id, n] of Object.entries(notes)) if (allow.has(id)) out[id] = n;
    return out;
  }, [notes, tagFilter, tagIds]);

  const tree = useMemo(
    () => buildTree(Object.values(folders), Object.values(filteredNotes)),
    [folders, filteredNotes],
  );

  const empty = Object.keys(filteredNotes).length === 0 && tree.folders.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="flex items-center justify-between px-3 pt-3 pb-1"
        style={{ color: "var(--vf-muted)" }}
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-wider">
          Notes
        </span>
      </div>
      <div className="flex-1 overflow-y-auto pb-2">
        {empty ? (
          <div
            className="px-3 py-4 text-center text-[12px]"
            style={{ color: "var(--vf-subtle)" }}
          >
            {tagFilter ? "No notes match this tag." : "No notes yet. Create one."}
          </div>
        ) : (
          <TreeBody
            node={tree}
            depth={0}
            expanded={expanded}
            onToggleFolder={toggleFolder}
          />
        )}
      </div>
    </div>
  );
}
