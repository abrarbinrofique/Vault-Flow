import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useVaultStore } from "../../stores/useVaultStore";
import { useUiStore } from "../../stores/useUiStore";
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

  const sortedFolders = [...folders].sort((a, b) =>
    a.path.localeCompare(b.path),
  );
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
  }
  return root;
}

function FolderRow({ node, depth }: { node: TreeNode; depth: number }) {
  const {
    activeNoteId,
    setActiveNote,
    createNote,
    createFolder,
    renameNote,
    deleteNote,
    renameFolder,
    deleteFolder,
  } = useVaultStore(
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

  const pad = { paddingLeft: `${depth * 12}px` } as const;

  return (
    <div>
      {node.path !== "" && (
        <div
          className="group flex items-center justify-between px-2 py-1 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          style={pad}
        >
          <span className="truncate">📁 {node.name}</span>
          <span className="hidden gap-1 group-hover:flex">
            <button
              className="text-xs opacity-70 hover:opacity-100"
              onClick={async () => {
                const t = window.prompt("New note title");
                if (t) await createNote({ title: t, path: node.path });
              }}
              title="New note here"
            >
              +N
            </button>
            <button
              className="text-xs opacity-70 hover:opacity-100"
              onClick={async () => {
                const n = window.prompt("New folder name");
                if (n) await createFolder(n, node.path);
              }}
              title="New folder here"
            >
              +F
            </button>
            <button
              className="text-xs opacity-70 hover:opacity-100"
              onClick={async () => {
                const n = window.prompt("Rename folder", node.name);
                if (n && n !== node.name) await renameFolder(node.path, n);
              }}
              title="Rename"
            >
              ✎
            </button>
            <button
              className="text-xs opacity-70 hover:opacity-100"
              onClick={async () => {
                if (window.confirm(`Delete folder "${node.name}" and all its notes?`))
                  await deleteFolder(node.path);
              }}
              title="Delete"
            >
              ✕
            </button>
          </span>
        </div>
      )}

      {node.folders.map((child) => (
        <FolderRow key={child.path} node={child} depth={depth + 1} />
      ))}

      {node.notes.map((note) => (
        <div
          key={note.id}
          className={`group flex items-center justify-between px-2 py-1 text-sm cursor-pointer ${
            activeNoteId === note.id
              ? "bg-blue-100 dark:bg-blue-900/40"
              : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
          }`}
          style={{ paddingLeft: `${(depth + 1) * 12}px` }}
          onClick={() => setActiveNote(note.id)}
        >
          <span className="truncate">📄 {note.title}</span>
          <span className="hidden gap-1 group-hover:flex">
            <button
              className="text-xs opacity-70 hover:opacity-100"
              onClick={async (e) => {
                e.stopPropagation();
                const n = window.prompt("Rename note", note.title);
                if (n && n !== note.title) await renameNote(note.id, n);
              }}
              title="Rename"
            >
              ✎
            </button>
            <button
              className="text-xs opacity-70 hover:opacity-100"
              onClick={async (e) => {
                e.stopPropagation();
                if (window.confirm(`Delete "${note.title}"?`))
                  await deleteNote(note.id);
              }}
              title="Delete"
            >
              ✕
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function FileTree() {
  const notes = useVaultStore((s) => s.notes);
  const folders = useVaultStore((s) => s.folders);
  const createNote = useVaultStore((s) => s.createNote);
  const createFolder = useVaultStore((s) => s.createFolder);

  const tagFilter = useUiStore((s) => s.tagFilter);
  const tagIds = useVaultStore((s) =>
    tagFilter ? s.linkIndex.tags[tagFilter] : null,
  );

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
          Vault
        </span>
        <div className="flex gap-2">
          <button
            className="text-xs opacity-70 hover:opacity-100"
            onClick={async () => {
              const t = window.prompt("New note title");
              if (t) await createNote({ title: t });
            }}
          >
            + Note
          </button>
          <button
            className="text-xs opacity-70 hover:opacity-100"
            onClick={async () => {
              const n = window.prompt("New folder name");
              if (n) await createFolder(n);
            }}
          >
            + Folder
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        <FolderRow node={tree} depth={0} />
      </div>
    </div>
  );
}
