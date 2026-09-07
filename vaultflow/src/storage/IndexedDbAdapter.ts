import type { StorageAdapter } from "./StorageAdapter";
import type { Note } from "../types";
import { getDb } from "./db";

export class IndexedDbAdapter implements StorageAdapter {
  async listFiles(): Promise<Note[]> {
    const db = await getDb();
    return db.getAll("notes");
  }

  async readFile(id: string): Promise<Note | null> {
    const db = await getDb();
    return (await db.get("notes", id)) ?? null;
  }

  async writeFile(note: Note): Promise<void> {
    const db = await getDb();
    await db.put("notes", { ...note, updatedAt: Date.now() });
  }

  async deleteFile(id: string): Promise<void> {
    const db = await getDb();
    await db.delete("notes", id);
  }

  async createFile(input: {
    title: string;
    path?: string;
    content?: string;
  }): Promise<Note> {
    const now = Date.now();
    const note: Note = {
      id: crypto.randomUUID(),
      title: input.title,
      path: input.path ?? "",
      content: input.content ?? "",
      createdAt: now,
      updatedAt: now,
    };
    const db = await getDb();
    await db.put("notes", note);
    return note;
  }
}

export const storage: StorageAdapter = new IndexedDbAdapter();
