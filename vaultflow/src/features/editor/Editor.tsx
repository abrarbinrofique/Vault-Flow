import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { completionKeymap } from "@codemirror/autocomplete";
import { useVaultStore } from "../../stores/useVaultStore";
import { debounce } from "../../lib/debounce";
import { wikilinkAutocomplete } from "./wikilinkComplete";
import { wikilinkClick } from "./wikilinkClick";
import { livePreview } from "./livePreview";
import { proseStyling } from "./prose";
import { codeCopyButtons } from "./codeCopy";

const baseExtensions = [
  history(),
  keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap]),
  markdown(),
  proseStyling(),
  codeCopyButtons(),
  wikilinkAutocomplete(),
  wikilinkClick(),
  livePreview(),
  EditorView.lineWrapping,
];

interface EditorProps {
  noteId: string;
  initialContent: string;
}

export default function Editor({ noteId, initialContent }: EditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const noteIdRef = useRef(noteId);

  useEffect(() => {
    noteIdRef.current = noteId;
  }, [noteId]);

  useEffect(() => {
    if (!hostRef.current) return;

    const persist = debounce((id: string, content: string) => {
      void useVaultStore.getState().updateNoteContent(id, content);
    }, 400);

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        persist(noteIdRef.current, update.state.doc.toString());
      }
    });

    const view = new EditorView({
      state: EditorState.create({
        doc: initialContent,
        extensions: [...baseExtensions, updateListener],
      }),
      parent: hostRef.current,
    });
    viewRef.current = view;

    return () => {
      persist.flush();
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === initialContent) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: initialContent },
    });
  }, [noteId, initialContent]);

  return <div ref={hostRef} className="h-full w-full" />;
}
