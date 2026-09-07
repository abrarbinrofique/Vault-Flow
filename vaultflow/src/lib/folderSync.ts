/**
 * Live 2-way mirror between the vault (IndexedDB) and a user-picked local folder
 * via the File System Access API. IndexedDB remains the source of truth; the
 * folder is a mirror that gets updated on note writes and read once on connect.
 *
 * Chromium-only. Firefox/Safari should hide the UI.
 */

import type { Note } from "../types";
import { getMeta, setMeta } from "../storage/db";

const HANDLE_KEY = "folderHandle";

export type FolderStatus = "disconnected" | "connecting" | "connected" | "denied";

interface FolderState {
  handle: FileSystemDirectoryHandle | null;
  status: FolderStatus;
  error: string | null;
}

const state: FolderState = { handle: null, status: "disconnected", error: null };
const listeners = new Set<(s: FolderState) => void>();

function emit() {
  for (const l of listeners) l({ ...state });
}

export function subscribeFolder(l: (s: FolderState) => void): () => void {
  listeners.add(l);
  l({ ...state });
  return () => listeners.delete(l);
}

export function isFolderSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export function getFolderState(): FolderState {
  return { ...state };
}

// -- filename helpers -------------------------------------------------------

// eslint-disable-next-line no-control-regex
const UNSAFE = /[<>:"/\\|?*\x00-\x1F]/g;
function safeSegment(s: string): string {
  return s.replace(UNSAFE, "_").trim();
}

function fileName(note: Pick<Note, "title" | "id">): string {
  const t = safeSegment(note.title) || note.id;
  return `${t}.md`;
}

function pathSegments(p: string): string[] {
  return p ? p.split("/").filter(Boolean).map(safeSegment) : [];
}

// -- FSA helpers ------------------------------------------------------------

async function ensureDir(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const seg of segments) {
    dir = await dir.getDirectoryHandle(seg, { create: true });
  }
  return dir;
}

async function getExistingDir(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle | null> {
  let dir = root;
  for (const seg of segments) {
    try {
      dir = await dir.getDirectoryHandle(seg, { create: false });
    } catch {
      return null;
    }
  }
  return dir;
}

async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  request: boolean,
): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  // @ts-expect-error - queryPermission is present on handles in Chromium
  const q: PermissionState = await handle.queryPermission(opts);
  if (q === "granted") return true;
  if (!request) return false;
  // @ts-expect-error - requestPermission is present on handles in Chromium
  const r: PermissionState = await handle.requestPermission(opts);
  return r === "granted";
}

// -- import from folder -----------------------------------------------------

async function* walkFiles(
  dir: FileSystemDirectoryHandle,
  prefix: string[] = [],
): AsyncGenerator<{ file: File; path: string[]; name: string }> {
  // @ts-expect-error - entries() is present on directory handles
  for await (const [name, entry] of dir.entries()) {
    const h = entry as FileSystemHandle;
    if (h.kind === "directory") {
      yield* walkFiles(h as FileSystemDirectoryHandle, [...prefix, name]);
    } else if (h.kind === "file" && name.toLowerCase().endsWith(".md")) {
      const fh = h as FileSystemFileHandle;
      const file = await fh.getFile();
      yield { file, path: prefix, name };
    }
  }
}

export interface ImportedNote {
  title: string;
  path: string;
  content: string;
  updatedAt: number;
}

async function importFromHandle(
  handle: FileSystemDirectoryHandle,
): Promise<ImportedNote[]> {
  const out: ImportedNote[] = [];
  for await (const { file, path, name } of walkFiles(handle)) {
    const content = await file.text();
    const title = name.replace(/\.md$/i, "");
    out.push({
      title,
      path: path.join("/"),
      content,
      updatedAt: file.lastModified,
    });
  }
  return out;
}

// -- public API -------------------------------------------------------------

export async function connectFolder(): Promise<ImportedNote[] | null> {
  if (!isFolderSupported()) {
    state.error = "File System Access API not supported in this browser.";
    state.status = "denied";
    emit();
    return null;
  }
  state.status = "connecting";
  state.error = null;
  emit();

  try {
    // @ts-expect-error - showDirectoryPicker is not in the base lib types
    const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
      id: "vaultflow-folder",
      mode: "readwrite",
    });
    const ok = await verifyPermission(handle, true);
    if (!ok) {
      state.status = "denied";
      state.error = "Permission denied";
      emit();
      return null;
    }
    state.handle = handle;
    state.status = "connected";
    emit();
    await setMeta(HANDLE_KEY, handle);
    return await importFromHandle(handle);
  } catch (e) {
    // AbortError = user cancelled the picker; leave disconnected quietly.
    if (e instanceof DOMException && e.name === "AbortError") {
      state.status = "disconnected";
      emit();
      return null;
    }
    state.status = "denied";
    state.error = (e as Error).message ?? "Failed to connect folder";
    emit();
    return null;
  }
}

export async function disconnectFolder(): Promise<void> {
  state.handle = null;
  state.status = "disconnected";
  state.error = null;
  emit();
  await setMeta(HANDLE_KEY, null);
}

/**
 * Called on app load. If a handle is stored, restore state without prompting.
 * The user will need a gesture to re-grant permission if it lapsed.
 */
export async function restoreFolderIfAny(): Promise<void> {
  if (!isFolderSupported()) return;
  const stored = await getMeta<FileSystemDirectoryHandle | null>(HANDLE_KEY);
  if (!stored) return;
  state.handle = stored;
  const granted = await verifyPermission(stored, false);
  state.status = granted ? "connected" : "denied";
  emit();
}

/**
 * User-gesture-required call to re-grant permission after reload.
 */
export async function requestReconnect(): Promise<boolean> {
  if (!state.handle) return false;
  const ok = await verifyPermission(state.handle, true);
  state.status = ok ? "connected" : "denied";
  emit();
  return ok;
}

// -- mirror operations -----------------------------------------------------

async function withHandle<T>(
  fn: (h: FileSystemDirectoryHandle) => Promise<T>,
): Promise<T | undefined> {
  const h = state.handle;
  if (!h || state.status !== "connected") return undefined;
  try {
    return await fn(h);
  } catch (e) {
    console.warn("[folderSync]", e);
    return undefined;
  }
}

export function mirrorWriteNote(note: Note, prev?: Note): void {
  void withHandle(async (root) => {
    // If title or path changed, delete the old file first.
    if (prev && (prev.title !== note.title || prev.path !== note.path)) {
      const oldDir = await getExistingDir(root, pathSegments(prev.path));
      if (oldDir) {
        try {
          await oldDir.removeEntry(fileName(prev));
        } catch {
          /* file may not exist */
        }
      }
    }
    const dir = await ensureDir(root, pathSegments(note.path));
    const fh = await dir.getFileHandle(fileName(note), { create: true });
    const writable = await fh.createWritable();
    await writable.write(note.content);
    await writable.close();
  });
}

export function mirrorDeleteNote(note: Pick<Note, "title" | "path" | "id">): void {
  void withHandle(async (root) => {
    const dir = await getExistingDir(root, pathSegments(note.path));
    if (!dir) return;
    try {
      await dir.removeEntry(fileName(note));
    } catch {
      /* not present */
    }
  });
}

export function mirrorCreateFolder(path: string): void {
  void withHandle(async (root) => {
    await ensureDir(root, pathSegments(path));
  });
}

export function mirrorDeleteFolder(path: string): void {
  void withHandle(async (root) => {
    const segs = pathSegments(path);
    if (segs.length === 0) return;
    const parent = await getExistingDir(root, segs.slice(0, -1));
    if (!parent) return;
    try {
      await parent.removeEntry(segs[segs.length - 1], { recursive: true });
    } catch {
      /* already gone */
    }
  });
}
