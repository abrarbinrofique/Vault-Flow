import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

type PromptResolve = (value: string | null) => void;
type ConfirmResolve = (value: boolean) => void;

export interface PromptOpts {
  title: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Return a string to keep the dialog open with that as an error message. */
  validate?: (value: string) => string | null;
}

export interface ConfirmOpts {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type DialogConfig =
  | ({ kind: "prompt"; resolve: PromptResolve } & PromptOpts)
  | ({ kind: "confirm"; resolve: ConfirmResolve } & ConfirmOpts);

let current: DialogConfig | null = null;
const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

function open(cfg: DialogConfig) {
  // If another dialog is already open, dismiss it as a cancel.
  if (current) closeInternal(null);
  current = cfg;
  notify();
}

function closeInternal(result: unknown) {
  const c = current;
  current = null;
  notify();
  if (!c) return;
  if (c.kind === "prompt") c.resolve(result as string | null);
  else c.resolve(result as boolean);
}

export function promptText(opts: PromptOpts): Promise<string | null> {
  return new Promise((resolve) => {
    open({ kind: "prompt", resolve, ...opts });
  });
}

export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    open({ kind: "confirm", resolve, ...opts });
  });
}

export function DialogHost() {
  const [cfg, setCfg] = useState<DialogConfig | null>(current);
  useEffect(() => {
    const l = () => setCfg(current);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (!cfg) return null;
  return cfg.kind === "prompt" ? (
    <PromptDialog cfg={cfg} />
  ) : (
    <ConfirmDialog cfg={cfg} />
  );
}

function Shell({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center pt-32"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
      onMouseDown={onDismiss}
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
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

function Header({ title, danger }: { title: string; danger?: boolean }) {
  return (
    <div
      className="flex items-center gap-2 px-4"
      style={{
        height: 44,
        borderBottom: "1px solid var(--vf-border)",
      }}
    >
      <span
        style={{
          color: danger ? "#e11d48" : "var(--vf-muted)",
          display: "inline-flex",
        }}
      >
        <Icon name={danger ? "trash" : "edit"} size={14} />
      </span>
      <span
        className="text-[13px] font-semibold tracking-tight"
        style={{ color: "var(--vf-fg)" }}
      >
        {title}
      </span>
    </div>
  );
}

function Footer({
  onCancel,
  onConfirm,
  confirmLabel,
  cancelLabel,
  danger,
  disabled,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-end gap-2 px-4"
      style={{
        height: 52,
        borderTop: "1px solid var(--vf-border)",
        background: "var(--vf-bg)",
      }}
    >
      <button className="vf-btn" onClick={onCancel}>
        {cancelLabel}
      </button>
      <button
        className="vf-btn vf-btn-primary"
        onClick={onConfirm}
        disabled={disabled}
        style={
          danger
            ? {
                background: "#e11d48",
                color: "white",
                opacity: disabled ? 0.5 : 1,
              }
            : { opacity: disabled ? 0.5 : 1 }
        }
      >
        {confirmLabel}
      </button>
    </div>
  );
}

function PromptDialog({
  cfg,
}: {
  cfg: Extract<DialogConfig, { kind: "prompt" }>;
}) {
  const [value, setValue] = useState(cfg.initialValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, []);

  const submit = () => {
    const err = cfg.validate?.(value) ?? null;
    if (err) {
      setError(err);
      return;
    }
    closeInternal(value);
  };
  const cancel = () => closeInternal(null);

  return (
    <Shell onDismiss={cancel}>
      <Header title={cfg.title} danger={cfg.danger} />
      <div className="px-4 py-3">
        {cfg.label && (
          <label
            className="mb-1.5 block text-[11.5px] uppercase tracking-wider"
            style={{ color: "var(--vf-muted)" }}
          >
            {cfg.label}
          </label>
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            } else if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={cfg.placeholder}
          className="w-full rounded px-3 py-2 text-[14px] outline-none"
          style={{
            background: "var(--vf-bg)",
            color: "var(--vf-fg)",
            border: `1px solid ${error ? "#e11d48" : "var(--vf-border)"}`,
          }}
        />
        {error && (
          <div className="mt-1.5 text-[12px]" style={{ color: "#e11d48" }}>
            {error}
          </div>
        )}
      </div>
      <Footer
        onCancel={cancel}
        onConfirm={submit}
        confirmLabel={cfg.submitLabel ?? "OK"}
        cancelLabel={cfg.cancelLabel ?? "Cancel"}
        danger={cfg.danger}
      />
    </Shell>
  );
}

function ConfirmDialog({
  cfg,
}: {
  cfg: Extract<DialogConfig, { kind: "confirm" }>;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeInternal(false);
      else if (e.key === "Enter") closeInternal(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <Shell onDismiss={() => closeInternal(false)}>
      <Header title={cfg.title} danger={cfg.danger} />
      {cfg.message && (
        <div
          className="px-4 py-3 text-[13.5px]"
          style={{ color: "var(--vf-fg-secondary)", lineHeight: 1.55 }}
        >
          {cfg.message}
        </div>
      )}
      <Footer
        onCancel={() => closeInternal(false)}
        onConfirm={() => closeInternal(true)}
        confirmLabel={cfg.confirmLabel ?? (cfg.danger ? "Delete" : "OK")}
        cancelLabel={cfg.cancelLabel ?? "Cancel"}
        danger={cfg.danger}
      />
    </Shell>
  );
}
