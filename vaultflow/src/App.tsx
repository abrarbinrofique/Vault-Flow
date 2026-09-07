import { useEffect, useState } from "react";
import FileTree from "./features/filetree/FileTree";
import NotePane from "./features/editor/NotePane";
import TagPane from "./features/tags/TagPane";
import CommandPalette from "./features/commandpalette/CommandPalette";
import GraphView from "./features/graph/GraphView";
import { useVaultStore } from "./stores/useVaultStore";
import { useUiStore } from "./stores/useUiStore";

export default function App() {
  const loadAll = useVaultStore((s) => s.loadAll);
  const loaded = useVaultStore((s) => s.loaded);
  const activeNoteId = useVaultStore((s) => s.activeNoteId);
  const loadTheme = useUiStore((s) => s.loadTheme);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const splitNoteId = useUiStore((s) => s.splitNoteId);
  const openSplit = useUiStore((s) => s.openSplit);
  const closeSplit = useUiStore((s) => s.closeSplit);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);

  useEffect(() => {
    void loadAll();
    void loadTheme();
  }, [loadAll, loadTheme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="flex h-screen"
      style={{ background: "var(--vf-bg)", color: "var(--vf-fg)" }}
    >
      <aside
        className="flex w-64 flex-col border-r"
        style={{ borderColor: "var(--vf-border)" }}
      >
        <div
          className="flex items-center justify-between border-b px-3 py-2"
          style={{ borderColor: "var(--vf-border)" }}
        >
          <span className="text-sm font-semibold">VaultFlow</span>
          <div className="flex gap-2">
            <button
              onClick={() => setGraphOpen(true)}
              className="text-xs opacity-70 hover:opacity-100"
              title="Graph view"
            >
              ◎
            </button>
            <button
              onClick={() => void toggleTheme()}
              className="text-xs opacity-70 hover:opacity-100"
              title="Toggle theme"
            >
              {theme === "dark" ? "☀︎" : "☾"}
            </button>
          </div>
        </div>
        {loaded ? (
          <>
            <TagPane />
            <FileTree />
          </>
        ) : (
          <div className="p-3 text-xs opacity-70">Loading…</div>
        )}
      </aside>
      <main className="flex flex-1 overflow-hidden">
        {activeNoteId ? (
          <div
            className={splitNoteId ? "flex-1 border-r" : "flex-1"}
            style={{ borderColor: "var(--vf-border)" }}
          >
            <NotePane
              noteId={activeNoteId}
              right={
                !splitNoteId && (
                  <button
                    onClick={() => openSplit(activeNoteId)}
                    className="text-xs opacity-70 hover:opacity-100"
                    title="Split right"
                  >
                    ⇹
                  </button>
                )
              }
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm opacity-60">
            Select or create a note.
          </div>
        )}
        {splitNoteId && (
          <div className="flex-1">
            <NotePane
              noteId={splitNoteId}
              right={
                <button
                  onClick={closeSplit}
                  className="text-xs opacity-70 hover:opacity-100"
                  title="Close split"
                >
                  ✕
                </button>
              }
            />
          </div>
        )}
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {graphOpen && <GraphView onClose={() => setGraphOpen(false)} />}
    </div>
  );
}
