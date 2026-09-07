import { useEffect, useState } from "react";
import FileTree from "./features/filetree/FileTree";
import NotePane from "./features/editor/NotePane";
import TagPane from "./features/tags/TagPane";
import CommandPalette from "./features/commandpalette/CommandPalette";
import GraphView from "./features/graph/GraphView";
import EmptyState from "./features/editor/EmptyState";
import Icon from "./components/Icon";
import { useVaultStore } from "./stores/useVaultStore";
import { useUiStore } from "./stores/useUiStore";
import { openDailyNote } from "./features/dailynotes/openDailyNote";

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
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

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
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  return (
    <div className="flex h-screen">
      {/* Icon rail */}
      <div
        className="flex w-11 flex-col items-center justify-between border-r py-2"
        style={{
          background: "var(--vf-sidebar)",
          borderColor: "var(--vf-border)",
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <button
            className="vf-icon-btn"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar (Ctrl+\)"
            title="Toggle sidebar"
          >
            <Icon name="sidebar" />
          </button>
          <button
            className="vf-icon-btn"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette (Ctrl+P)"
            title="Search (Ctrl+P)"
          >
            <Icon name="search" />
          </button>
          <button
            className="vf-icon-btn"
            onClick={() => setGraphOpen(true)}
            aria-label="Open graph view"
            title="Graph view"
          >
            <Icon name="graph" />
          </button>
          <button
            className="vf-icon-btn"
            onClick={() => void openDailyNote()}
            aria-label="Open today's daily note"
            title="Daily note"
          >
            <Icon name="calendar" />
          </button>
        </div>
        <button
          className="vf-icon-btn"
          onClick={() => void toggleTheme()}
          aria-label="Toggle theme"
          title="Toggle theme"
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>
      </div>

      {/* Sidebar */}
      {!sidebarCollapsed && (
        <aside
          className="flex w-64 flex-col border-r"
          style={{
            background: "var(--vf-sidebar)",
            borderColor: "var(--vf-border)",
          }}
        >
          <div
            className="flex items-center justify-between px-3"
            style={{ height: 44 }}
          >
            <span
              className="text-[13px] font-semibold tracking-tight"
              style={{ color: "var(--vf-fg)" }}
            >
              VaultFlow
            </span>
            <button
              className="vf-btn vf-btn-primary"
              onClick={async () => {
                const t = window.prompt("New note title");
                if (t) await useVaultStore.getState().createNote({ title: t });
              }}
              style={{ height: 26, padding: "0 8px", fontSize: 12 }}
            >
              <Icon name="plus" size={13} />
              New
            </button>
          </div>
          {loaded ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <TagPane />
              <FileTree />
            </div>
          ) : (
            <div className="p-3 text-xs" style={{ color: "var(--vf-muted)" }}>
              Loading…
            </div>
          )}
        </aside>
      )}

      {/* Main area */}
      <main className="flex flex-1 overflow-hidden" style={{ background: "var(--vf-bg)" }}>
        {activeNoteId ? (
          <div
            className={splitNoteId ? "flex flex-1 flex-col border-r" : "flex flex-1 flex-col"}
            style={{ borderColor: "var(--vf-border)" }}
          >
            <NotePane
              noteId={activeNoteId}
              actions={
                !splitNoteId && (
                  <button
                    onClick={() => openSplit(activeNoteId)}
                    className="vf-icon-btn"
                    aria-label="Split right"
                    title="Split right"
                  >
                    <Icon name="split" />
                  </button>
                )
              }
            />
          </div>
        ) : (
          <EmptyState />
        )}
        {splitNoteId && (
          <div className="flex flex-1 flex-col">
            <NotePane
              noteId={splitNoteId}
              actions={
                <button
                  onClick={closeSplit}
                  className="vf-icon-btn"
                  aria-label="Close split"
                  title="Close split"
                >
                  <Icon name="close" />
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
