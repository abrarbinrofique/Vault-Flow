import Icon from "../../components/Icon";
import { useVaultStore } from "../../stores/useVaultStore";
import { openDailyNote } from "../dailynotes/openDailyNote";
import { promptText } from "../../components/dialog";

export default function EmptyState() {
  const createNote = useVaultStore((s) => s.createNote);

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background: "var(--vf-accent-soft)",
            color: "var(--vf-accent)",
          }}
        >
          <Icon name="file" size={26} />
        </div>
        <h1
          className="mb-1 text-[18px] font-semibold tracking-tight"
          style={{ color: "var(--vf-fg)" }}
        >
          Welcome to VaultFlow
        </h1>
        <p className="mb-6 text-[13px]" style={{ color: "var(--vf-muted)" }}>
          Your local-first, offline-capable knowledge base. Start with a fresh
          note, or open today's daily note.
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            className="vf-btn vf-btn-primary"
            onClick={async () => {
              const t = await promptText({
                title: "New note",
                label: "Title",
                submitLabel: "Create",
              });
              if (t) await createNote({ title: t });
            }}
          >
            <Icon name="plus" size={14} />
            New note
          </button>
          <button className="vf-btn" onClick={() => void openDailyNote()}>
            <Icon name="calendar" size={14} />
            Today's daily note
          </button>
        </div>
        <div
          className="mt-6 text-[11.5px]"
          style={{ color: "var(--vf-subtle)" }}
        >
          <span className="vf-kbd">Ctrl</span> +{" "}
          <span className="vf-kbd">P</span> to search &middot;{" "}
          <span className="vf-kbd">Ctrl</span> +{" "}
          <span className="vf-kbd">\</span> to toggle sidebar
        </div>
      </div>
    </div>
  );
}
