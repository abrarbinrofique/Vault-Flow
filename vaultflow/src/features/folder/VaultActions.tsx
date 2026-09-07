import { useRef, useState } from "react";
import Icon from "../../components/Icon";
import { useVaultStore } from "../../stores/useVaultStore";
import {
  exportVaultAsZip,
  importVaultFromZip,
  triggerDownload,
} from "../../lib/vaultZip";

export default function VaultActions() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const importFromFolder = useVaultStore((s) => s.importFromFolder);

  const onExport = async () => {
    setBusy("export");
    try {
      const notes = Object.values(useVaultStore.getState().notes);
      const { blob, filename } = await exportVaultAsZip(notes);
      triggerDownload(blob, filename);
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  const onImport = async (file: File) => {
    setBusy("import");
    try {
      const imported = await importVaultFromZip(file);
      await importFromFolder(imported);
      window.alert(`Imported ${imported.length} note${imported.length === 1 ? "" : "s"}.`);
    } catch (e) {
      window.alert(`Import failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        className="vf-icon-btn"
        onClick={() => setOpen((v) => !v)}
        title="Vault backup"
        aria-label="Vault backup"
      >
        <Icon name="more" />
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImport(f);
          e.target.value = "";
        }}
      />

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-full z-50 ml-1 min-w-[180px] overflow-hidden vf-panel"
            style={{
              background: "var(--vf-surface)",
              boxShadow: "var(--vf-shadow-md)",
            }}
          >
            <button
              onClick={() => void onExport()}
              disabled={busy !== null}
              className="flex w-full items-center gap-2 px-3 text-left text-[12.5px]"
              style={{ height: 30, color: "var(--vf-fg-secondary)" }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = "var(--vf-surface-hover)")
              }
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="file" size={13} />
              {busy === "export" ? "Exporting…" : "Export vault (.zip)"}
            </button>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={busy !== null}
              className="flex w-full items-center gap-2 px-3 text-left text-[12.5px]"
              style={{ height: 30, color: "var(--vf-fg-secondary)" }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = "var(--vf-surface-hover)")
              }
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Icon name="folder" size={13} />
              {busy === "import" ? "Importing…" : "Import vault (.zip)"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
