import { format } from "date-fns";
import { useVaultStore } from "../../stores/useVaultStore";
import { substituteTemplate } from "../../lib/templates";
import { setPendingCursor } from "../editor/pendingCursor";
import { findTemplateByName } from "../templates/newFromTemplate";

const DAILY_FOLDER = "Daily";

export async function openDailyNote(date: Date = new Date()): Promise<void> {
  const title = format(date, "yyyy-MM-dd");
  const state = useVaultStore.getState();

  const existing = Object.values(state.notes).find(
    (n) => n.path === DAILY_FOLDER && n.title.toLowerCase() === title.toLowerCase(),
  );
  if (existing) {
    state.setActiveNote(existing.id);
    return;
  }

  if (!state.folders[DAILY_FOLDER]) {
    await state.createFolder(DAILY_FOLDER);
  }

  const template = findTemplateByName("Daily");
  let content: string;
  let cursor: number | null = null;
  if (template) {
    const r = substituteTemplate(template.content, { title, now: date });
    content = r.content;
    cursor = r.cursor;
  } else {
    content = `# ${format(date, "EEEE, MMMM d, yyyy")}\n\n`;
  }

  const created = await state.createNote({ title, path: DAILY_FOLDER, content });
  if (cursor !== null) setPendingCursor(created.id, cursor);
}
