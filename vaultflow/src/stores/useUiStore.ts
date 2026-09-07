import { create } from "zustand";
import { getMeta, setMeta } from "../storage/db";

const THEME_KEY = "theme";
const LINK_HINTS_KEY = "linkHintsEnabled";

type Theme = "light" | "dark";

interface UiState {
  theme: Theme;
  tagFilter: string | null;
  splitNoteId: string | null;
  sidebarCollapsed: boolean;
  quickCaptureOpen: boolean;
  linkHintsEnabled: boolean;
  loadTheme: () => Promise<void>;
  toggleTheme: () => Promise<void>;
  toggleLinkHints: () => Promise<void>;
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
  linkHintsEnabled: true,
  toggleLinkHints: async () => {
    const next = !get().linkHintsEnabled;
    set({ linkHintsEnabled: next });
    await setMeta(LINK_HINTS_KEY, next);
  },
  loadTheme: async () => {
    const stored = (await getMeta<Theme>(THEME_KEY)) ?? "light";
    applyTheme(stored);
    const hints = (await getMeta<boolean>(LINK_HINTS_KEY)) ?? true;
    set({ theme: stored, linkHintsEnabled: hints });
  },
  toggleTheme: async () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    set({ theme: next });
    await setMeta(THEME_KEY, next);
  },
}));
