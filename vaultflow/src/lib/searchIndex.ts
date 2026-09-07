import MiniSearch from "minisearch";
import type { Note } from "../types";

export interface SearchHit {
  id: string;
  title: string;
  score: number;
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

export function replaceAll(ms: MiniSearch<Note>, notes: Note[]): void {
  ms.removeAll();
  ms.addAll(notes);
}

export function upsert(ms: MiniSearch<Note>, note: Note): void {
  if (ms.has(note.id)) ms.replace(note);
  else ms.add(note);
}

export function remove(ms: MiniSearch<Note>, id: string): void {
  if (ms.has(id)) ms.discard(id);
}

export function search(ms: MiniSearch<Note>, query: string, limit = 20): SearchHit[] {
  if (!query.trim()) return [];
  return ms
    .search(query)
    .slice(0, limit)
    .map((r) => ({ id: String(r.id), title: String(r.title), score: r.score }));
}
