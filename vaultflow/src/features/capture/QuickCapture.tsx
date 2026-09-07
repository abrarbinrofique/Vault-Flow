import { useEffect, useRef, useState } from "react";
import Icon from "../../components/Icon";
import { useUiStore } from "../../stores/useUiStore";
import { captureToInbox } from "./quickCapture";

interface Props {
  open: boolean;
  onClose: () => void;
  restoreFocus: () => void;
}

export default function QuickCapture({ open, onClose, restoreFocus }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setText("");
      setBusy(false);
      setTimeout(() => areaRef.current?.focus(), 0);
    }
  }, [open]);

  const close = () => {
    onClose();
    // Restore whatever was focused before the modal took over.
    setTimeout(restoreFocus, 0);
  };

  const save = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await captureToInbox(value);
      setToast(true);
      setTimeout(() => setToast(false), 1400);
      close();
    } catch (e) {
      setBusy(false);
      window.alert(`Capture failed: ${(e as Error).message}`);
    }
  };

  if (!open && !toast) return null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-32"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
          onMouseDown={close}
        >
          <div
            className="w-[460px] max-w-[92vw] overflow-hidden"
            style={{
              background: "var(--vf-surface)",
              border: "1px solid var(--vf-border)",
              borderRadius: "var(--vf-radius-lg)",
              boxShadow: "var(--vf-shadow-lg)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center gap-2 px-3"
              style={{
                height: 40,
                borderBottom: "1px solid var(--vf-border)",
                color: "var(--vf-muted)",
              }}
            >
              <Icon name="plus" size={14} />
              <span className="text-[12px] font-semibold uppercase tracking-wider">
                Quick capture
              </span>
              <span className="ml-auto text-[11px]" style={{ color: "var(--vf-subtle)" }}>
                → Inbox
              </span>
            </div>
            <textarea
              ref={areaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  close();
                } else if (
                  e.key === "Enter" &&
                  (e.ctrlKey || e.metaKey || !text.includes("\n"))
                ) {
                  // Ctrl/Cmd+Enter always saves; plain Enter saves for single-line.
                  e.preventDefault();
                  void save();
                }
              }}
              placeholder="Capture a thought…"
              rows={3}
              className="block w-full resize-none bg-transparent px-4 py-3 text-[14px] outline-none"
              style={{ color: "var(--vf-fg)", minHeight: 88 }}
            />
            <div
              className="flex items-center justify-between px-3 text-[11px]"
              style={{
                height: 32,
                borderTop: "1px solid var(--vf-border)",
                background: "var(--vf-bg)",
                color: "var(--vf-subtle)",
              }}
            >
              <span>
                <span className="vf-kbd">Esc</span> cancel
              </span>
              <span>
                <span className="vf-kbd">Ctrl</span> +{" "}
                <span className="vf-kbd">Enter</span> save
              </span>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="fixed left-1/2 z-[60] -translate-x-1/2"
          style={{
            bottom: 32,
            background: "var(--vf-surface)",
            color: "var(--vf-fg)",
            border: "1px solid var(--vf-border)",
            borderRadius: "var(--vf-radius)",
            boxShadow: "var(--vf-shadow-md)",
            padding: "8px 12px",
            fontSize: 12.5,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          role="status"
          aria-live="polite"
        >
          <span style={{ color: "var(--vf-accent)", display: "inline-flex" }}>
            <Icon name="check" size={14} />
          </span>
          Captured to Inbox
        </div>
      )}
    </>
  );
}

// Exported wrapper so App can just render <QuickCaptureHost /> without prop plumbing.
export function QuickCaptureHost() {
  const open = useUiStore((s) => s.quickCaptureOpen);
  const close = useUiStore((s) => s.closeQuickCapture);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    if (open) previouslyFocused.current = document.activeElement;
  }, [open]);

  const restoreFocus = () => {
    const el = previouslyFocused.current as HTMLElement | null;
    if (el && typeof el.focus === "function") {
      el.focus();
    }
  };

  return <QuickCapture open={open} onClose={close} restoreFocus={restoreFocus} />;
}
