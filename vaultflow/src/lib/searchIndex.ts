import MiniSearch from "minisearch";
import type { Note } from "../types";

export interface SearchHit {
  id: string;
  title: string;
  score: number;
  matchedTerms: string[];
  matchedInTitle: boolean;
  matchedInContent: boolean;
}

export function createSearchIndex(): MiniSearch<Note> {
  return new MiniSearch<Note>({
    fields: ["title", "content"],
    storeFields: ["title"],
    idField: "id",
    searchOptions: {
      boost: { title: 3 },
      fuzzy: 0.2,
      prefix: true,
    },
  });
}

function forIndex(note: Note): Note {
  // Drawings store JSON scenes in content — indexing that produces noisy hits.
  // Index the title only for drawings.
  if (note.kind === "drawing") return { ...note, content: "" };
  return note;
}

export function replaceAll(ms: MiniSearch<Note>, notes: Note[]): void {
  ms.removeAll();
  ms.addAll(notes.map(forIndex));
}

export function upsert(ms: MiniSearch<Note>, note: Note): void {
  const indexed = forIndex(note);
  if (ms.has(indexed.id)) ms.replace(indexed);
  else ms.add(indexed);
}

export function remove(ms: MiniSearch<Note>, id: string): void {
  if (ms.has(id)) ms.discard(id);
}

export function search(ms: MiniSearch<Note>, query: string, limit = 20): SearchHit[] {
  if (!query.trim()) return [];
  const results = ms.search(query);
  const hits: SearchHit[] = results.map((r) => {
    const match = (r.match ?? {}) as Record<string, string[]>;
    const matchedTerms = Object.keys(match);
    let matchedInTitle = false;
    let matchedInContent = false;
    for (const fields of Object.values(match)) {
      if (fields.includes("title")) matchedInTitle = true;
      if (fields.includes("content")) matchedInContent = true;
    }
    return {
      id: String(r.id),
      title: String(r.title),
      score: r.score,
      matchedTerms,
      matchedInTitle,
      matchedInContent,
    };
  });

  // Title matches first, then content-only matches; within each group by score desc.
  hits.sort((a, b) => {
    if (a.matchedInTitle !== b.matchedInTitle) return a.matchedInTitle ? -1 : 1;
    return b.score - a.score;
  });

  return hits.slice(0, limit);
}

/**
 * Returns the first matched-term occurrence in the note content, as three
 * parts (before, match, after) suitable for highlighting.
 */
export function snippetFor(
  content: string,
  terms: string[],
  radius = 50,
): { before: string; match: string; after: string } | null {
  if (!content || terms.length === 0) return null;
  const lower = content.toLowerCase();
  let bestIdx = -1;
  let bestLen = 0;
  for (const t of terms) {
    if (!t) continue;
    const idx = lower.indexOf(t.toLowerCase());
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
      bestLen = t.length;
    }
  }
  if (bestIdx === -1) return null;
  const from = Math.max(0, bestIdx - radius);
  const to = Math.min(content.length, bestIdx + bestLen + radius);
  return {
    before:
      (from > 0 ? "… " : "") +
      content.slice(from, bestIdx).replace(/\s+/g, " "),
    match: content.slice(bestIdx, bestIdx + bestLen),
    after:
      content.slice(bestIdx + bestLen, to).replace(/\s+/g, " ") +
      (to < content.length ? " …" : ""),
  };
}
