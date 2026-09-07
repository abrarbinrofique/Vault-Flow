import { useMemo } from "react";
import { useVaultStore } from "../../stores/useVaultStore";
import { useUiStore } from "../../stores/useUiStore";

export default function TagPane() {
  const tags = useVaultStore((s) => s.linkIndex.tags);
  const tagFilter = useUiStore((s) => s.tagFilter);
  const setTagFilter = useUiStore((s) => s.setTagFilter);

  const entries = useMemo(
    () =>
      Object.entries(tags)
        .map(([t, ids]) => [t, ids.length] as const)
        .sort((a, b) => a[0].localeCompare(b[0])),
    [tags],
  );

  if (entries.length === 0) return null;

  return (
    <div
      className="border-b px-3 pt-3 pb-2"
      style={{ borderColor: "var(--vf-border)" }}
    >
      <div className="mb-2 flex items-center justify-between" style={{ color: "var(--vf-muted)" }}>
        <span className="text-[10.5px] font-semibold uppercase tracking-wider">
          Tags
        </span>
        {tagFilter && (
          <button
            onClick={() => setTagFilter(null)}
            className="text-[11px]"
            style={{ color: "var(--vf-accent)" }}
          >
            clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {entries.map(([tag, count]) => {
          const active = tag === tagFilter;
          return (
            <button
              key={tag}
              onClick={() => setTagFilter(active ? null : tag)}
              className="inline-flex items-center gap-1 rounded px-2 text-[11.5px]"
              style={{
                height: 22,
                background: active
                  ? "var(--vf-accent)"
                  : "var(--vf-surface-hover)",
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
  );
}
