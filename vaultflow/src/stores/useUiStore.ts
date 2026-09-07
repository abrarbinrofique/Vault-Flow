import { create } from "zustand";
import { getMeta, setMeta } from "../storage/db";

const THEME_KEY = "theme";

type Theme = "light" | "dark";

interface UiState {
  theme: Theme;
  loadTheme: () => Promise<void>;
  toggleTheme: () => Promise<void>;
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: "light",
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
