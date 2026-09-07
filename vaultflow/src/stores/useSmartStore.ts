import { create } from "zustand";
import { getMeta, setMeta } from "../storage/db";
import type { SmartFolder } from "../lib/smartFolders";

const META_KEY = "smartFolders";

interface SmartState {
  folders: SmartFolder[];
  loaded: boolean;
  load: () => Promise<void>;
  add: (input: Omit<SmartFolder, "id">) => Promise<SmartFolder>;
  update: (id: string, patch: Partial<SmartFolder>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

async function persist(folders: SmartFolder[]) {
  await setMeta(META_KEY, folders);
}

export const useSmartStore = create<SmartState>((set, get) => ({
  folders: [],
  loaded: false,
  load: async () => {
    const stored = await getMeta<SmartFolder[]>(META_KEY);
    if (stored && Array.isArray(stored)) {
      set({ folders: stored, loaded: true });
      return;
    }
    // Seed one example — "📌 #todo".
    const seed: SmartFolder[] = [
      {
        id: crypto.randomUUID(),
        name: "📌 #todo",
        tags: ["todo"],
      },
    ];
    await persist(seed);
    set({ folders: seed, loaded: true });
  },
  add: async (input) => {
    const folder: SmartFolder = { id: crypto.randomUUID(), ...input };
    const next = [...get().folders, folder];
    set({ folders: next });
    await persist(next);
    return folder;
  },
  update: async (id, patch) => {
    const next = get().folders.map((f) =>
      f.id === id ? { ...f, ...patch } : f,
    );
    set({ folders: next });
    await persist(next);
  },
  remove: async (id) => {
    const next = get().folders.filter((f) => f.id !== id);
    set({ folders: next });
    await persist(next);
  },
}));
