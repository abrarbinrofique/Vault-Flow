import type { LinkIndex, Note } from "../types";

export interface SmartFolder {
  id: string;
  name: string;
  query?: string;
  tags?: string[];
  modifiedWithinDays?: number;
}

/**
 * Live-evaluate a smart folder against the current vault. Pure function; the
 * caller provides notes, the link index (for tag membership), and a
 * search runner. No caching — call it every time the folder is opened.
 */
export function evaluateSmartFolder(
  folder: SmartFolder,
  notes: Record<string, Note>,
  linkIndex: LinkIndex,
  searchRunner: (query: string, limit: number) => { id: string }[],
  now: number = Date.now(),
): Note[] {
  let candidates: Note[] = Object.values(notes);

  if (folder.query && folder.query.trim()) {
    const hits = searchRunner(folder.query, 500);
    const ids = new Set(hits.map((h) => h.id));
    candidates = candidates.filter((n) => ids.has(n.id));
  }

  if (folder.tags && folder.tags.length > 0) {
    const tagSets = folder.tags.map(
      (t) => new Set(linkIndex.tags[t.toLowerCase()] ?? []),
    );
    candidates = candidates.filter((n) => tagSets.every((s) => s.has(n.id)));
  }

  if (folder.modifiedWithinDays && folder.modifiedWithinDays > 0) {
    const cutoff = now - folder.modifiedWithinDays * 86_400_000;
    candidates = candidates.filter((n) => n.updatedAt >= cutoff);
  }

  return candidates.sort((a, b) => b.updatedAt - a.updatedAt);
}
