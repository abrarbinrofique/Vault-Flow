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
import {
  createSearchIndex,
  remove as removeFromSearch,
  replaceAll as replaceSearch,
  search as runSearch,
  upsert as upsertSearch,
  type SearchHit,
} from "../lib/searchIndex";
import {
  mirrorCreateFolder,
  mirrorDeleteFolder,
  mirrorDeleteNote,
  mirrorWriteNote,
} from "../lib/folderSync";

const searchIndex = createSearchIndex();

export function searchNotes(query: string, limit?: number): SearchHit[] {
  return runSearch(searchIndex, query, limit);
}

const FOLDERS_KEY = "folders";

interface VaultState {
  notes: Record<string, Note>;
  folders: Record<string, Folder>;
  activeNoteId: string | null;
  loaded: boolean;
  linkIndex: LinkIndex;

  loadAll: () => Promise<void>;
  setActiveNote: (id: string | null) => void;

  createNote: (input: {
    title: string;
    path?: string;
    content?: string;
    kind?: import("../types").NoteKind;
  }) => Promise<Note>;
  renameNote: (id: string, newTitle: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  updateNoteContent: (id: string, content: string) => Promise<void>;

  moveNote: (id: string, newPath: string) => Promise<void>;

  createFolder: (name: string, parentPath?: string) => Promise<void>;
  renameFolder: (oldPath: string, newName: string) => Promise<void>;
  deleteFolder: (path: string) => Promise<void>;

  importFromFolder: (imported: {
    title: string;
    path: string;
    content: string;
  }[]) => Promise<void>;

  clearVault: () => Promise<void>;
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
    replaceSearch(searchIndex, list);
    set({ notes, folders, loaded: true, linkIndex });
  },

  setActiveNote: (id) => set({ activeNoteId: id }),

  createNote: async ({ title, path, content, kind }) => {
    const note = await storage.createFile({ title, path: path ?? "", content, kind });
    upsertSearch(searchIndex, note);
    mirrorWriteNote(note);
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

    upsertSearch(searchIndex, renamed);
    mirrorWriteNote(renamed, note);
    for (const r of rewritten) {
      upsertSearch(searchIndex, r);
      mirrorWriteNote(r, r); // content changed only; same filename
    }

    set((s) => {
      const notes = { ...s.notes, [id]: renamed };
      for (const r of rewritten) notes[r.id] = r;
      let linkIndex = updateLinkIndex(s.linkIndex, renamed);
      for (const r of rewritten) linkIndex = updateLinkIndex(linkIndex, r);
      return { notes, linkIndex };
    });
  },

  moveNote: async (id, newPath) => {
    const note = get().notes[id];
    if (!note) return;
    if (note.path === newPath) return;
    const updated: Note = { ...note, path: newPath, updatedAt: Date.now() };
    await storage.writeFile(updated);
    upsertSearch(searchIndex, updated);
    mirrorWriteNote(updated, note);
    set((s) => ({
      notes: { ...s.notes, [id]: updated },
      linkIndex: updateLinkIndex(s.linkIndex, updated),
    }));
  },

  deleteNote: async (id) => {
    const existing = get().notes[id];
    await storage.deleteFile(id);
    removeFromSearch(searchIndex, id);
    if (existing) mirrorDeleteNote(existing);
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
    upsertSearch(searchIndex, updated);
    mirrorWriteNote(updated);
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
    mirrorCreateFolder(path);
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

    mirrorCreateFolder(newPath);
    for (const n of affected) {
      const prev = state.notes[n.id];
      mirrorWriteNote(n, prev);
    }
    mirrorDeleteFolder(oldPath);
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
    for (const id of toDelete) {
      linkIndex = removeFromLinkIndex(linkIndex, id);
      removeFromSearch(searchIndex, id);
    }

    set({ folders, notes, activeNoteId, linkIndex });
    await Promise.all(toDelete.map((id) => storage.deleteFile(id)));
    await persistFolders(folders);
    mirrorDeleteFolder(path);
  },

  clearVault: async () => {
    const state = get();
    const ids = Object.keys(state.notes);
    await Promise.all(ids.map((id) => storage.deleteFile(id)));
    for (const id of ids) removeFromSearch(searchIndex, id);
    await persistFolders({});
    set({
      notes: {},
      folders: {},
      activeNoteId: null,
      linkIndex: emptyLinkIndex(),
    });
  },

  importFromFolder: async (imported: {
    title: string;
    path: string;
    content: string;
  }[]) => {
    // Import notes as new notes (do not delete IDB ones that aren't in the folder).
    const nowNotes = { ...get().notes };
    const folders = { ...get().folders };
    for (const imp of imported) {
      const dup = Object.values(nowNotes).find(
        (n) =>
          n.path === imp.path &&
          n.title.toLowerCase() === imp.title.toLowerCase(),
      );
      if (dup) {
        if (dup.content !== imp.content) {
          const updated = { ...dup, content: imp.content, updatedAt: Date.now() };
          await storage.writeFile(updated);
          upsertSearch(searchIndex, updated);
          nowNotes[dup.id] = updated;
        }
        continue;
      }
      const created = await storage.createFile({
        title: imp.title,
        path: imp.path,
        content: imp.content,
      });
      upsertSearch(searchIndex, created);
      nowNotes[created.id] = created;

      // Ensure ancestor folders exist in the vault store too.
      const segs = imp.path ? imp.path.split("/").filter(Boolean) : [];
      let acc = "";
      for (const seg of segs) {
        acc = acc ? `${acc}/${seg}` : seg;
        if (!folders[acc]) {
          folders[acc] = { id: crypto.randomUUID(), name: seg, path: acc };
        }
      }
    }
    const linkIndex = buildLinkIndex(Object.values(nowNotes));
    replaceSearch(searchIndex, Object.values(nowNotes));
    await persistFolders(folders);
    set({ notes: nowNotes, folders, linkIndex });
  },
}));
