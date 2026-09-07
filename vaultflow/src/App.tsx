import { useEffect, useState } from "react";
import FileTree from "./features/filetree/FileTree";
import NotePane from "./features/editor/NotePane";
import TagPane from "./features/tags/TagPane";
import CommandPalette from "./features/commandpalette/CommandPalette";
import GraphView from "./features/graph/GraphView";
import EmptyState from "./features/editor/EmptyState";
import FolderStatus from "./features/folder/FolderStatus";
import VaultActions from "./features/folder/VaultActions";
import { QuickCaptureHost } from "./features/capture/QuickCapture";
import Icon from "./components/Icon";
import { useVaultStore } from "./stores/useVaultStore";
import { useUiStore } from "./stores/useUiStore";
import { openDailyNote } from "./features/dailynotes/openDailyNote";
import { useIsMobile } from "./hooks/useMediaQuery";

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

  const isMobile = useIsMobile();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);

  useEffect(() => {
    void loadAll();
    void loadTheme();
  }, [loadAll, loadTheme]);

  // On first mobile detection, collapse the sidebar so it stays hidden by default.
  const [didAutoCollapse, setDidAutoCollapse] = useState(false);
  useEffect(() => {
    if (isMobile && !sidebarCollapsed && !didAutoCollapse) {
      useUiStore.setState({ sidebarCollapsed: true });
    }
    if (isMobile) setDidAutoCollapse(true);
  }, [isMobile, sidebarCollapsed, didAutoCollapse]);

  // Auto-close sidebar overlay after picking a note on mobile.
  useEffect(() => {
    if (isMobile && activeNoteId && !sidebarCollapsed) {
      useUiStore.setState({ sidebarCollapsed: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNoteId, isMobile]);

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
      // Quick capture: Ctrl/Cmd+Shift+Space (Ctrl+Shift+N is browser-reserved).
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.code === "Space" || e.key === " ")
      ) {
        e.preventDefault();
        useUiStore.getState().openQuickCapture();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar]);

  const sidebarOpen = !sidebarCollapsed;
  const showSplit = !!splitNoteId && !isMobile;

  return (
    <div className="vf-shell">
      {/* Icon rail */}
      <div
        className="vf-rail flex w-11 flex-col items-center justify-between border-r py-2"
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
          <FolderStatus />
          <VaultActions />
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

      {/* Backdrop for mobile overlay sidebar */}
      {isMobile && (
        <div
          className="vf-backdrop"
          data-open={sidebarOpen}
          onClick={() => useUiStore.setState({ sidebarCollapsed: true })}
        />
      )}

      {/* Sidebar */}
      {(sidebarOpen || isMobile) && (
        <aside
          className="vf-sidebar flex flex-col border-r"
          data-open={sidebarOpen}
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
      <main className="vf-main flex" style={{ background: "var(--vf-bg)" }}>
        {activeNoteId ? (
          <div
            className={showSplit ? "flex flex-1 flex-col border-r" : "flex flex-1 flex-col"}
            style={{ borderColor: "var(--vf-border)" }}
          >
            <NotePane
              noteId={activeNoteId}
              actions={
                !showSplit && !isMobile && (
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
        {showSplit && (
          <div className="flex flex-1 flex-col">
            <NotePane
              noteId={splitNoteId!}
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
      <QuickCaptureHost />
    </div>
  );
}
