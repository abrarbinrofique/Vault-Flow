import { create } from "zustand";
import type { Folder, LinkIndex, Note } from "../types";
import { storage } from "../storage/IndexedDbAdapter";
import { getMeta, setMeta } from "../storage/db";
import {
  buildLinkIndex,
  emptyLinkIndex,
  removeFromLinkIndex,
  updateLinkIndex,
} from "../lib/linkIndex";

const FOLDERS_KEY = "folders";

interface VaultState {
  notes: Record<string, Note>;
  folders: Record<string, Folder>;
  activeNoteId: string | null;
  loaded: boolean;
  linkIndex: LinkIndex;

  loadAll: () => Promise<void>;
  setActiveNote: (id: string | null) => void;

  createNote: (input: { title: string; path?: string; content?: string }) => Promise<Note>;
  renameNote: (id: string, newTitle: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  updateNoteContent: (id: string, content: string) => Promise<void>;

  createFolder: (name: string, parentPath?: string) => Promise<void>;
  renameFolder: (oldPath: string, newName: string) => Promise<void>;
  deleteFolder: (path: string) => Promise<void>;
}

async function persistFolders(folders: Record<string, Folder>) {
  await setMeta(FOLDERS_KEY, folders);
}

function joinPath(parent: string | undefined, name: string): string {
  if (!parent) return name;
  return `${parent}/${name}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Rewrite [[oldTitle]] and [[oldTitle|alias]] to use newTitle, case-insensitive on the title. */
function rewriteWikilinks(content: string, oldTitle: string, newTitle: string): string {
  const re = new RegExp(
    `(?<!!)\\[\\[(${escapeRegex(oldTitle)})(\\|[^\\]]+)?\\]\\]`,
    "gi",
  );
  return content.replace(re, (_m, _t, alias) => `[[${newTitle}${alias ?? ""}]]`);
}

export const useVaultStore = create<VaultState>((set, get) => ({
  notes: {},
  folders: {},
  activeNoteId: null,
  loaded: false,
  linkIndex: emptyLinkIndex(),

  loadAll: async () => {
    const list = await storage.listFiles();
    const notes: Record<string, Note> = {};
    for (const n of list) notes[n.id] = n;
    const folders = (await getMeta<Record<string, Folder>>(FOLDERS_KEY)) ?? {};
    const linkIndex = buildLinkIndex(list);
    set({ notes, folders, loaded: true, linkIndex });
  },

  setActiveNote: (id) => set({ activeNoteId: id }),

  createNote: async ({ title, path, content }) => {
    const note = await storage.createFile({ title, path: path ?? "", content });
    set((s) => ({
      notes: { ...s.notes, [note.id]: note },
      activeNoteId: note.id,
      linkIndex: updateLinkIndex(s.linkIndex, note),
    }));
    return note;
  },

  renameNote: async (id, newTitle) => {
    const state = get();
    const note = state.notes[id];
    if (!note || newTitle === note.title) return;

    const oldTitle = note.title;
    const renamed: Note = { ...note, title: newTitle, updatedAt: Date.now() };

    // Find source notes that link to the old title.
    const sourceIds = state.linkIndex.backlinks[oldTitle.toLowerCase()] ?? [];
    const rewritten: Note[] = [];
    for (const sid of sourceIds) {
      if (sid === id) continue;
      const src = state.notes[sid];
      if (!src) continue;
      const newContent = rewriteWikilinks(src.content, oldTitle, newTitle);
      if (newContent !== src.content) {
        rewritten.push({ ...src, content: newContent, updatedAt: Date.now() });
      }
    }

    await storage.writeFile(renamed);
    await Promise.all(rewritten.map((n) => storage.writeFile(n)));

    set((s) => {
      const notes = { ...s.notes, [id]: renamed };
      for (const r of rewritten) notes[r.id] = r;
      let linkIndex = updateLinkIndex(s.linkIndex, renamed);
      for (const r of rewritten) linkIndex = updateLinkIndex(linkIndex, r);
      return { notes, linkIndex };
    });
  },

  deleteNote: async (id) => {
    await storage.deleteFile(id);
    set((s) => {
      const next = { ...s.notes };
      delete next[id];
      return {
        notes: next,
        activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
        linkIndex: removeFromLinkIndex(s.linkIndex, id),
      };
    });
  },

  updateNoteContent: async (id, content) => {
    const note = get().notes[id];
    if (!note) return;
    if (note.content === content) return;
    const updated: Note = { ...note, content, updatedAt: Date.now() };
    await storage.writeFile(updated);
    set((s) => ({
      notes: { ...s.notes, [id]: updated },
      linkIndex: updateLinkIndex(s.linkIndex, updated),
    }));
  },

  createFolder: async (name, parentPath) => {
    const path = joinPath(parentPath, name);
    if (get().folders[path]) return;
    const folder: Folder = { id: crypto.randomUUID(), name, path };
    const folders = { ...get().folders, [path]: folder };
    set({ folders });
    await persistFolders(folders);
  },

  renameFolder: async (oldPath, newName) => {
    const state = get();
    const folder = state.folders[oldPath];
    if (!folder) return;
    const parent = oldPath.includes("/")
      ? oldPath.slice(0, oldPath.lastIndexOf("/"))
      : "";
    const newPath = joinPath(parent || undefined, newName);
    if (newPath === oldPath) return;

    const folders: Record<string, Folder> = {};
    for (const [p, f] of Object.entries(state.folders)) {
      if (p === oldPath) {
        folders[newPath] = { ...f, name: newName, path: newPath };
      } else if (p.startsWith(oldPath + "/")) {
        const remapped = newPath + p.slice(oldPath.length);
        folders[remapped] = { ...f, path: remapped };
      } else {
        folders[p] = f;
      }
    }

    const notes = { ...state.notes };
    const affected: Note[] = [];
    for (const n of Object.values(notes)) {
      if (n.path === oldPath || n.path.startsWith(oldPath + "/")) {
        const remapped = newPath + n.path.slice(oldPath.length);
        const updated = { ...n, path: remapped, updatedAt: Date.now() };
        notes[n.id] = updated;
        affected.push(updated);
      }
    }

    set({ folders, notes });
    await Promise.all(affected.map((n) => storage.writeFile(n)));
    await persistFolders(folders);
  },

  deleteFolder: async (path) => {
    const state = get();
    const folders: Record<string, Folder> = {};
    for (const [p, f] of Object.entries(state.folders)) {
      if (p !== path && !p.startsWith(path + "/")) folders[p] = f;
    }
    const notes = { ...state.notes };
    const toDelete: string[] = [];
    for (const n of Object.values(notes)) {
      if (n.path === path || n.path.startsWith(path + "/")) {
        toDelete.push(n.id);
        delete notes[n.id];
      }
    }
    let activeNoteId = state.activeNoteId;
    if (activeNoteId && toDelete.includes(activeNoteId)) activeNoteId = null;

    let linkIndex = state.linkIndex;
    for (const id of toDelete) linkIndex = removeFromLinkIndex(linkIndex, id);

    set({ folders, notes, activeNoteId, linkIndex });
    await Promise.all(toDelete.map((id) => storage.deleteFile(id)));
    await persistFolders(folders);
  },
}));
