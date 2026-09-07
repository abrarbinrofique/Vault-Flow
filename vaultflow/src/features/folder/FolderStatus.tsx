import { useEffect, useState } from "react";
import Icon from "../../components/Icon";
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
      if (!window.confirm("Disconnect local folder? Notes stay in the browser.")) return;
      await disconnectFolder();
      return;
    }
    if (status === "denied") {
      await requestReconnect();
      return;
    }
    const imported = await connectFolder();
    if (imported) {
      await importFromFolder(imported);
      await loadAll();
      if (error) window.alert(error);
    }
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
