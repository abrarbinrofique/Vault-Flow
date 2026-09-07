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
    <div className="border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
          Tags
        </span>
        {tagFilter && (
          <button
            onClick={() => setTagFilter(null)}
            className="text-xs opacity-70 hover:opacity-100"
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
              className={`rounded px-1.5 py-0.5 text-xs ${
                active
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
              }`}
            >
              #{tag} <span className="opacity-60">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
