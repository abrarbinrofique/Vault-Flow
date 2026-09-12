import type { LinkIndex, Note } from "../types";
import { parseTags, parseWikilinks } from "./markdown";
import { isTemplatePath } from "./templates";

export function emptyLinkIndex(): LinkIndex {
  return { outbound: {}, backlinks: {}, tags: {} };
}

export function buildLinkIndex(notes: Note[]): LinkIndex {
  const idx = emptyLinkIndex();
  for (const n of notes) applyNote(idx, n);
  return idx;
}

/**
 * Incrementally update the index for a single note: strip its previous
 * contributions, then insert the current ones.
 */
export function updateLinkIndex(prev: LinkIndex, note: Note): LinkIndex {
  const next = stripNote(prev, note.id);
  applyNote(next, note);
  return next;
}

export function removeFromLinkIndex(prev: LinkIndex, noteId: string): LinkIndex {
  return stripNote(prev, noteId);
}

function stripNote(prev: LinkIndex, noteId: string): LinkIndex {
  const outbound = { ...prev.outbound };
  const oldOutbound = outbound[noteId] ?? [];
  delete outbound[noteId];

  const backlinks = { ...prev.backlinks };
  for (const title of oldOutbound) {
    const key = title.toLowerCase();
    const list = backlinks[key];
    if (!list) continue;
    const filtered = list.filter((id) => id !== noteId);
    if (filtered.length) backlinks[key] = filtered;
    else delete backlinks[key];
  }

  const tags = { ...prev.tags };
  for (const [tag, ids] of Object.entries(tags)) {
    if (ids.includes(noteId)) {
      const filtered = ids.filter((id) => id !== noteId);
      if (filtered.length) tags[tag] = filtered;
      else delete tags[tag];
    }
  }

  return { outbound, backlinks, tags };
}

function applyNote(idx: LinkIndex, note: Note): void {
  // Templates are scaffolding, not knowledge — skip them from the link/tag graph.
  if (isTemplatePath(note.path)) return;
  // Drawings and sheets don't contain wikilinks or tags — their content is JSON.
  if (note.kind === "drawing" || note.kind === "sheet") return;
  const links = parseWikilinks(note.content);
  const titles = links.map((l) => l.title);
  if (titles.length) idx.outbound[note.id] = titles;

  for (const title of titles) {
    const key = title.toLowerCase();
    (idx.backlinks[key] ||= []).push(note.id);
  }

  const noteTags = parseTags(note.content);
  for (const tag of noteTags) {
    (idx.tags[tag] ||= []).push(note.id);
  }
}
