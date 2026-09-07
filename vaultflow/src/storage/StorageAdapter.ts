import type { Note, NoteKind } from "../types";

export interface StorageAdapter {
  listFiles(): Promise<Note[]>;
  readFile(id: string): Promise<Note | null>;
  writeFile(note: Note): Promise<void>;
  deleteFile(id: string): Promise<void>;
  createFile(input: {
    title: string;
    path?: string;
    content?: string;
    kind?: NoteKind;
  }): Promise<Note>;
}
