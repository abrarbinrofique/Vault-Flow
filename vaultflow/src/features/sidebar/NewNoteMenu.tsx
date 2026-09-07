import { useState } from "react";
import Icon from "../../components/Icon";
import { useVaultStore } from "../../stores/useVaultStore";
import { promptText } from "../../components/dialog";

export default function NewNoteMenu() {
  const [open, setOpen] = useState(false);

  const newNote = async () => {
    const t = await promptText({
      title: "New note",
      label: "Title",
      placeholder: "e.g. Weekly review",
      submitLabel: "Create",
    });
    if (t) await useVaultStore.getState().createNote({ title: t });
  };
  const newDrawing = async () => {
    const t = await promptText({
      title: "New drawing",
      label: "Title",
      placeholder: "e.g. System diagram",
      submitLabel: "Create",
    });
    if (t)
      await useVaultStore
        .getState()
        .createNote({ title: t, kind: "drawing" });
  };

  return (
    <div className="relative">
      <button
        className="vf-btn vf-btn-primary"
        onClick={() => setOpen((v) => !v)}
        style={{ height: 26, padding: "0 8px", fontSize: 12 }}
        aria-label="New…"
      >
        <Icon name="plus" size={13} />
        New
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 z-50 mt-1 min-w-[160px] overflow-hidden vf-panel"
            style={{
              boxShadow: "var(--vf-shadow-md)",
              background: "var(--vf-surface)",
            }}
          >
            <button
              onClick={() => {
                setOpen(false);
                void newNote();
              }}
              className="flex w-full items-center gap-2 px-3 text-left text-[12.5px]"
              style={{ height: 30, color: "var(--vf-fg-secondary)" }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = "var(--vf-surface-hover)")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <Icon name="file" size={13} /> New note
            </button>
            <button
              onClick={() => {
                setOpen(false);
                void newDrawing();
              }}
              className="flex w-full items-center gap-2 px-3 text-left text-[12.5px]"
              style={{ height: 30, color: "var(--vf-fg-secondary)" }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = "var(--vf-surface-hover)")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <Icon name="pen" size={13} /> New drawing
            </button>
          </div>
        </>
      )}
    </div>
  );
}
