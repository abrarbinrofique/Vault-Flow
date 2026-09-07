/**
 * Cross-component channel for "when this note next loads in the editor, place
 * the cursor at offset X". Used by template creation ({{cursor}}) and
 * potentially body-hit navigation later.
 */

const pending = new Map<string, number>();

export function setPendingCursor(noteId: string, offset: number): void {
  pending.set(noteId, offset);
}

export function takePendingCursor(noteId: string): number | null {
  const v = pending.get(noteId);
  if (v === undefined) return null;
  pending.delete(noteId);
  return v;
}
