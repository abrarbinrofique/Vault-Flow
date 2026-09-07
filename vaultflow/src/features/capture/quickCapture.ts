import { format } from "date-fns";
import { useVaultStore } from "../../stores/useVaultStore";

const INBOX_TITLE = "Inbox";

/**
 * Append the given text as a timestamped bullet to the Inbox note at the vault
 * root. Creates Inbox if missing. Preserves the currently active note (so the
 * user isn't navigated away from what they were reading/writing).
 */
export async function captureToInbox(raw: string): Promise<void> {
  const text = raw.trim();
  if (!text) return;

  const store = useVaultStore.getState();
  const prevActive = store.activeNoteId;

  let inbox = Object.values(store.notes).find(
    (n) => n.path === "" && n.title.toLowerCase() === INBOX_TITLE.toLowerCase(),
  );

  if (!inbox) {
    inbox = await store.createNote({
      title: INBOX_TITLE,
      path: "",
      content: "# Inbox\n\n",
    });
    // createNote sets it active — restore what the user had.
    useVaultStore.setState({ activeNoteId: prevActive });
  }

  const hhmm = format(new Date(), "HH:mm");
  const bullet = `- ${hhmm} — ${text}\n`;
  const current =
    useVaultStore.getState().notes[inbox.id]?.content ?? inbox.content ?? "";
  const nextContent = current + bullet;

  await useVaultStore.getState().updateNoteContent(inbox.id, nextContent);
}
