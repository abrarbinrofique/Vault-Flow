import type { Note } from "../../types";
import { useVaultStore } from "../../stores/useVaultStore";
import { isTemplatePath, substituteTemplate } from "../../lib/templates";
import { setPendingCursor } from "../editor/pendingCursor";

export function listTemplates(): Note[] {
  const notes = useVaultStore.getState().notes;
  return Object.values(notes)
    .filter((n) => isTemplatePath(n.path))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function findTemplateByName(name: string): Note | undefined {
  const target = name.toLowerCase();
  return listTemplates().find((t) => t.title.toLowerCase() === target);
}

export async function createFromTemplate(
  template: Note,
  title: string,
  path = "",
): Promise<Note> {
  const { content, cursor } = substituteTemplate(template.content, { title });
  const note = await useVaultStore.getState().createNote({ title, path, content });
  if (cursor !== null) setPendingCursor(note.id, cursor);
  return note;
}

/** Prompt-driven helper: title only. Returns null if the user cancels. */
export async function promptAndCreateFromTemplate(
  template: Note,
): Promise<Note | null> {
  const title = window.prompt(`New note from "${template.title}" — title?`);
  if (!title) return null;
  return createFromTemplate(template, title);
}
