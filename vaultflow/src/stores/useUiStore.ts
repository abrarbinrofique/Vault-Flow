import { create } from "zustand";
import { getMeta, setMeta } from "../storage/db";

const THEME_KEY = "theme";

type Theme = "light" | "dark";

interface UiState {
  theme: Theme;
  tagFilter: string | null;
  splitNoteId: string | null;
  sidebarCollapsed: boolean;
  quickCaptureOpen: boolean;
  loadTheme: () => Promise<void>;
  toggleTheme: () => Promise<void>;
  setTagFilter: (tag: string | null) => void;
  openSplit: (noteId: string) => void;
  closeSplit: () => void;
  toggleSidebar: () => void;
  openQuickCapture: () => void;
  closeQuickCapture: () => void;
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: "light",
  tagFilter: null,
  setTagFilter: (tag) => set({ tagFilter: tag }),
  splitNoteId: null,
  openSplit: (noteId) => set({ splitNoteId: noteId }),
  closeSplit: () => set({ splitNoteId: null }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  quickCaptureOpen: false,
  openQuickCapture: () => set({ quickCaptureOpen: true }),
  closeQuickCapture: () => set({ quickCaptureOpen: false }),
  loadTheme: async () => {
    const stored = (await getMeta<Theme>(THEME_KEY)) ?? "light";
    applyTheme(stored);
    set({ theme: stored });
  },
  toggleTheme: async () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    set({ theme: next });
    await setMeta(THEME_KEY, next);
  },
}));
