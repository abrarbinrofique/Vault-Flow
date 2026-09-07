import { useMemo, useState } from "react";
import Icon from "../../components/Icon";
import { useVaultStore } from "../../stores/useVaultStore";
import { useUiStore } from "../../stores/useUiStore";

export default function TagPane() {
  const tags = useVaultStore((s) => s.linkIndex.tags);
  const tagFilter = useUiStore((s) => s.tagFilter);
  const setTagFilter = useUiStore((s) => s.setTagFilter);
  const [open, setOpen] = useState(false);

  const entries = useMemo(
    () =>
      Object.entries(tags)
        .map(([t, ids]) => [t, ids.length] as const)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    [tags],
  );

  if (entries.length === 0) return null;

  return (
    <div
      className="border-b"
      style={{ borderColor: "var(--vf-border)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--vf-muted)" }}
      >
        <span
          className={`vf-chevron ${open ? "is-open" : ""}`}
          style={{ display: "inline-flex" }}
        >
          <Icon name="chevron-right" size={12} />
        </span>
        <Icon name="tag" size={12} />
        Tags
        <span style={{ color: "var(--vf-subtle)" }}>({entries.length})</span>
        {tagFilter && !open && (
          <span
            className="ml-auto rounded px-1.5 text-[10.5px]"
            style={{
              background: "var(--vf-accent-soft)",
              color: "var(--vf-accent)",
            }}
          >
            #{tagFilter}
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-2">
          {tagFilter && (
            <button
              onClick={() => setTagFilter(null)}
              className="mb-2 text-[11px]"
              style={{ color: "var(--vf-accent)" }}
            >
              clear filter
            </button>
          )}
          <div
            className="flex flex-wrap gap-1 overflow-y-auto"
            style={{ maxHeight: 180 }}
          >
            {entries.map(([tag, count]) => {
              const active = tag === tagFilter;
              return (
                <button
                  key={tag}
                  onClick={() => setTagFilter(active ? null : tag)}
                  className="inline-flex items-center gap-1 rounded px-2 text-[11.5px]"
                  style={{
                    height: 22,
                    background: active ? "var(--vf-accent)" : "var(--vf-surface-hover)",
                    color: active ? "var(--vf-on-accent)" : "var(--vf-fg-secondary)",
                    border: "1px solid",
                    borderColor: active ? "transparent" : "var(--vf-border)",
                    transition:
                      "background-color 140ms ease, color 140ms ease, border-color 140ms ease",
                  }}
                >
                  <span>#{tag}</span>
                  <span style={{ opacity: 0.55 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
