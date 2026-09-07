import { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import { debounce } from "../../lib/debounce";
import { useVaultStore } from "../../stores/useVaultStore";

// Lazy-loaded: Excalidraw is ~2MB, only enters the bundle when a drawing note is opened.
const Excalidraw = lazy(async () => {
  const mod = await import("@excalidraw/excalidraw");
  // @ts-expect-error - CSS side-effect import has no types
  await import("@excalidraw/excalidraw/index.css");
  return { default: mod.Excalidraw };
});

interface DrawingEditorProps {
  noteId: string;
  initialContent: string;
  theme: "light" | "dark";
}

interface StoredScene {
  elements?: unknown[];
  appState?: { viewBackgroundColor?: string };
  files?: Record<string, unknown>;
}

function parseScene(content: string): StoredScene {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object") return parsed as StoredScene;
  } catch {
    /* corrupt — start empty */
  }
  return {};
}

export default function DrawingEditor({
  noteId,
  initialContent,
  theme,
}: DrawingEditorProps) {
  const noteIdRef = useRef(noteId);
  useEffect(() => {
    noteIdRef.current = noteId;
  }, [noteId]);

  const initialData = useMemo(() => {
    const scene = parseScene(initialContent);
    // Excalidraw's InitialData typings are strict; our scene comes from JSON so
    // we surface it as `any`. We control both writer and reader here.
    return {
      elements: scene.elements ?? [],
      appState: {
        viewBackgroundColor:
          scene.appState?.viewBackgroundColor ??
          (theme === "dark" ? "#101115" : "#ffffff"),
      },
      files: scene.files ?? {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    // Only reparse when the note itself changes; we don't want to snap the
    // canvas back to disk on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const persist = useMemo(
    () =>
      debounce((id: string, content: string) => {
        void useVaultStore.getState().updateNoteContent(id, content);
      }, 500),
    [],
  );

  useEffect(
    () => () => {
      persist.flush();
    },
    [persist],
  );

  return (
    <div className="excalidraw-host" style={{ width: "100%", height: "100%" }}>
      <Suspense
        fallback={
          <div
            className="flex h-full items-center justify-center text-sm"
            style={{ color: "var(--vf-muted)" }}
          >
            Loading canvas…
          </div>
        }
      >
        <Excalidraw
          // Force full remount when the active note changes so scene state
          // doesn't leak between drawings.
          key={noteId}
          initialData={initialData}
          theme={theme}
          onChange={(elements, appState, files) => {
            // Only persist the fields we care about — full appState is volatile UI.
            const scene: StoredScene = {
              elements: elements as unknown[],
              appState: {
                viewBackgroundColor: appState.viewBackgroundColor,
              },
              files,
            };
            const payload = JSON.stringify(scene);
            const currentId = noteIdRef.current;
            // Guard: if the current note isn't the one this handler mounted for,
            // don't clobber the wrong note.
            if (currentId === noteId) persist(currentId, payload);
          }}
          UIOptions={{
            canvasActions: {
              saveAsImage: true,
              saveToActiveFile: false,
              loadScene: false,
              export: false,
              clearCanvas: true,
            },
          }}
        />
      </Suspense>
    </div>
  );
}
