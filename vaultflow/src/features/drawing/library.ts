/**
 * Global (single-vault) Excalidraw library persistence and file import helpers.
 * The library is stored in the meta store under one key and mirrors how
 * real Excalidraw treats libraries: shared across all drawings.
 */

import { getMeta, setMeta } from "../../storage/db";

const META_KEY = "excalidraw-library";

// Loose typing — the Excalidraw types for library items shift between minor
// versions, and we're only doing structural work (id dedupe + JSON persist).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LibraryItem = any;

export async function loadLibrary(): Promise<LibraryItem[]> {
  const stored = await getMeta<LibraryItem[]>(META_KEY);
  return Array.isArray(stored) ? stored : [];
}

export async function saveLibrary(items: LibraryItem[]): Promise<void> {
  await setMeta(META_KEY, items);
}

/**
 * Merge two library-item lists deduping by `id`. Items later in the second
 * array take precedence.
 */
export function mergeLibrary(
  current: LibraryItem[],
  incoming: LibraryItem[],
): LibraryItem[] {
  const byId = new Map<string, LibraryItem>();
  for (const it of current) if (it && it.id) byId.set(String(it.id), it);
  for (const it of incoming) if (it && it.id) byId.set(String(it.id), it);
  return [...byId.values()];
}

/**
 * Parse an .excalidrawlib file. Handles:
 *   - modern (v2+): `{ type: "excalidrawlib", libraryItems: [{ id, elements, ... }, ...] }`
 *   - legacy (v1): `{ type: "excalidrawlib", version: 1, library: [[element, ...], [element, ...]] }`
 *   - a bare array of library items (some exports)
 * Throws on invalid input.
 */
export function parseLibraryFile(text: string): LibraryItem[] {
  const data = JSON.parse(text) as unknown;

  // Bare array
  if (Array.isArray(data)) return data as LibraryItem[];

  if (data && typeof data === "object") {
    const d = data as {
      type?: string;
      libraryItems?: LibraryItem[];
      library?: unknown[];
    };

    if (Array.isArray(d.libraryItems)) return d.libraryItems;

    // v1: library is an array of element arrays; wrap each into a library item.
    if (Array.isArray(d.library)) {
      const now = Date.now();
      return d.library
        .filter((entry): entry is unknown[] => Array.isArray(entry))
        .map((elements, i) => ({
          id: `imported-${now}-${i}-${Math.random().toString(36).slice(2, 8)}`,
          status: "published",
          elements,
          created: now,
        }));
    }
  }
  throw new Error("Not a valid .excalidrawlib file");
}

/** Read a File as text (browser). */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error ?? new Error("File read failed"));
    r.readAsText(file);
  });
}
