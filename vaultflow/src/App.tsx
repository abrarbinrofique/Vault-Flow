import { useEffect } from "react";
import FileTree from "./features/filetree/FileTree";
import Editor from "./features/editor/Editor";
import BacklinksPanel from "./features/backlinks/BacklinksPanel";
import TagPane from "./features/tags/TagPane";
import { useVaultStore } from "./stores/useVaultStore";
import { useUiStore } from "./stores/useUiStore";

export default function App() {
  const loadAll = useVaultStore((s) => s.loadAll);
  const loaded = useVaultStore((s) => s.loaded);
  const activeNote = useVaultStore((s) =>
    s.activeNoteId ? s.notes[s.activeNoteId] : null,
  );
  const loadTheme = useUiStore((s) => s.loadTheme);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  useEffect(() => {
    void loadAll();
    void loadTheme();
  }, [loadAll, loadTheme]);

  return (
    <div className="flex h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <aside className="flex w-64 flex-col border-r border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
          <span className="text-sm font-semibold">VaultFlow</span>
          <button
            onClick={() => void toggleTheme()}
            className="text-xs opacity-70 hover:opacity-100"
            title="Toggle theme"
          >
            {theme === "dark" ? "☀︎" : "☾"}
          </button>
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
      <main className="flex-1 overflow-hidden">
        {activeNote ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-neutral-200 px-4 py-2 text-sm dark:border-neutral-800">
              {activeNote.title}
            </div>
            <div className="flex-1 overflow-hidden">
              <Editor noteId={activeNote.id} initialContent={activeNote.content} />
            </div>
            <BacklinksPanel />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm opacity-60">
            Select or create a note.
          </div>
        )}
      </main>
    </div>
  );
}
