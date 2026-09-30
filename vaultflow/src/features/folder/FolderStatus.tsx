import { useEffect, useState } from "react";
import Icon from "../../components/Icon";
import { confirmDialog } from "../../components/dialog";
import {
  connectFolder,
  disconnectFolder,
  isFolderSupported,
  requestReconnect,
  restoreFolderIfAny,
  subscribeFolder,
  type FolderStatus as Status,
} from "../../lib/folderSync";
import { useVaultStore } from "../../stores/useVaultStore";

export default function FolderStatus() {
  const [status, setStatus] = useState<Status>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const importFromFolder = useVaultStore((s) => s.importFromFolder);
  const clearVault = useVaultStore((s) => s.clearVault);
  const loadAll = useVaultStore((s) => s.loadAll);

  useEffect(() => {
    void restoreFolderIfAny();
    return subscribeFolder((s) => {
      setStatus(s.status);
      setError(s.error);
    });
  }, []);

  if (!isFolderSupported()) {
    return (
      <button
        className="vf-icon-btn"
        title="Local folder sync requires Chrome / Edge / Brave"
        aria-label="Local folder sync unavailable"
        disabled
        style={{ opacity: 0.4, cursor: "not-allowed" }}
      >
        <Icon name="folder" />
      </button>
    );
  }

  const label =
    status === "connected"
      ? "Local folder connected — click to disconnect"
      : status === "denied"
        ? "Folder permission needed — click to reconnect"
        : status === "connecting"
          ? "Connecting…"
          : "Connect a local folder";

  const dotColor =
    status === "connected"
      ? "var(--vf-accent)"
      : status === "denied"
        ? "#f59e0b"
        : status === "connecting"
          ? "var(--vf-muted)"
          : "transparent";

  const onClick = async () => {
    if (status === "connected") {
      const ok = await confirmDialog({
        title: "Disconnect local folder?",
        message: "The vault will stop syncing with your folder. Files on disk stay untouched.",
        confirmLabel: "Disconnect",
      });
      if (!ok) return;
      await disconnectFolder();

      const noteCount = Object.keys(useVaultStore.getState().notes).length;
      if (noteCount > 0) {
        const alsoWipe = await confirmDialog({
          title: "Also remove notes from browser?",
          message: `${noteCount} note${noteCount === 1 ? "" : "s"} still live in the browser (IndexedDB). Remove them too? Files on disk are NOT affected.`,
          confirmLabel: "Remove from browser",
          cancelLabel: "Keep in browser",
          danger: true,
        });
        if (alsoWipe) await clearVault();
      }
      return;
    }
    if (status === "denied") {
      await requestReconnect();
      return;
    }
    const imported = await connectFolder();
    if (!imported) return;

    // If there are existing notes in the browser vault, ask whether to
    // REPLACE (wipe first, then import) or MERGE (keep both).
    const existingCount = Object.keys(
      useVaultStore.getState().notes,
    ).length;
    let shouldReplace = false;
    if (existingCount > 0) {
      shouldReplace = await confirmDialog({
        title: "Replace or merge?",
        message: `You have ${existingCount} note${existingCount === 1 ? "" : "s"} already in the browser. Replace them with the ${imported.length} file${imported.length === 1 ? "" : "s"} from this folder, or merge (keep both)?`,
        confirmLabel: "Replace",
        cancelLabel: "Merge",
        danger: true,
      });
    }

    if (shouldReplace) {
      await clearVault();
    }
    await importFromFolder(imported);
    await loadAll();
    if (error) window.alert(error);
  };

  return (
    <button
      className="vf-icon-btn"
      onClick={() => void onClick()}
      title={label}
      aria-label={label}
      style={{ position: "relative" }}
    >
      <Icon name="folder" />
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: 4,
          bottom: 4,
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dotColor,
          boxShadow: "0 0 0 2px var(--vf-sidebar)",
          transition: "background-color 200ms ease",
        }}
      />
    </button>
  );
}
