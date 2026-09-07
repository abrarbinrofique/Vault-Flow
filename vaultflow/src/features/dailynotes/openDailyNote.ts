import { format } from "date-fns";
import { useVaultStore } from "../../stores/useVaultStore";

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
  const heading = `# ${format(date, "EEEE, MMMM d, yyyy")}\n\n`;
  await state.createNote({ title, path: DAILY_FOLDER, content: heading });
}
