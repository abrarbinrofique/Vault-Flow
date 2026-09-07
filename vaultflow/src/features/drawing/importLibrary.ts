import {
  loadLibrary,
  mergeLibrary,
  parseLibraryFile,
  readFileText,
  saveLibrary,
  type LibraryItem,
} from "./library";
import { currentExcalidrawApi } from "./excalidrawApiRegistry";

export interface ImportResult {
  imported: number;
  totalAfter: number;
}

/**
 * Present a file picker, merge the picked .excalidrawlib into the persisted
 * library, and push it live to any mounted Excalidraw editor. Returns null
 * if the user cancels; throws on parse errors.
 */
export function importLibraryFromPicker(): Promise<ImportResult | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".excalidrawlib,application/json";
    input.style.display = "none";
    document.body.appendChild(input);

    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const text = await readFileText(file);
        const incoming = parseLibraryFile(text);
        if (incoming.length === 0) {
          reject(new Error("Library file contains no items."));
          return;
        }
        const current = await loadLibrary();
        const merged = mergeLibrary(current, incoming);
        await saveLibrary(merged);
        // Push into any open drawing editor so the panel updates immediately.
        const api = currentExcalidrawApi();
        if (api && typeof api.updateLibrary === "function") {
          try {
            await api.updateLibrary({ libraryItems: merged as LibraryItem[] });
          } catch {
            /* the imperative call may be unavailable in some versions — persistence still works */
          }
        }
        resolve({
          imported: incoming.length,
          totalAfter: merged.length,
        });
      } catch (e) {
        reject(e as Error);
      }
    };

    // Some browsers require the input to be in the document to trigger.
    input.click();
  });
}
