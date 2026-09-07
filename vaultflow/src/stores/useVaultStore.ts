import { create } from "zustand";
import type { Folder, Note } from "../types";
import { storage } from "../storage/IndexedDbAdapter";
import { getMeta, setMeta } from "../storage/db";

const FOLDERS_KEY = "folders";

interface VaultState {
  notes: Record<string, Note>;
  folders: Record<string, Folder>;
  activeNoteId: string | null;
  loaded: boolean;

  loadAll: () => Promise<void>;
  setActiveNote: (id: string | null) => void;

  createNote: (input: { title: string; path?: string }) => Promise<Note>;
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

export const useVaultStore = create<VaultState>((set, get) => ({
  notes: {},
  folders: {},
  activeNoteId: null,
  loaded: false,

  loadAll: async () => {
    const list = await storage.listFiles();
    const notes: Record<string, Note> = {};
    for (const n of list) notes[n.id] = n;
    const folders = (await getMeta<Record<string, Folder>>(FOLDERS_KEY)) ?? {};
    set({ notes, folders, loaded: true });
  },

  setActiveNote: (id) => set({ activeNoteId: id }),

  createNote: async ({ title, path }) => {
    const note = await storage.createFile({ title, path: path ?? "" });
    set((s) => ({
      notes: { ...s.notes, [note.id]: note },
      activeNoteId: note.id,
    }));
    return note;
  },

  renameNote: async (id, newTitle) => {
    const note = get().notes[id];
    if (!note) return;
    const updated: Note = { ...note, title: newTitle, updatedAt: Date.now() };
    await storage.writeFile(updated);
    set((s) => ({ notes: { ...s.notes, [id]: updated } }));
  },

  deleteNote: async (id) => {
    await storage.deleteFile(id);
    set((s) => {
      const next = { ...s.notes };
      delete next[id];
      return {
        notes: next,
        activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
      };
    });
  },

  updateNoteContent: async (id, content) => {
    const note = get().notes[id];
    if (!note) return;
    if (note.content === content) return;
    const updated: Note = { ...note, content, updatedAt: Date.now() };
    await storage.writeFile(updated);
    set((s) => ({ notes: { ...s.notes, [id]: updated } }));
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
    set({ folders, notes, activeNoteId });
    await Promise.all(toDelete.map((id) => storage.deleteFile(id)));
    await persistFolders(folders);
  },
}));
