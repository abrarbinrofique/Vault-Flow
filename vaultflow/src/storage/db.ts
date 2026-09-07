import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Note } from "../types";

interface VaultFlowDB extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: { "by-path": string; "by-updatedAt": number };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<VaultFlowDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<VaultFlowDB>> {
  if (!dbPromise) {
    dbPromise = openDB<VaultFlowDB>("vaultflow", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("notes")) {
          const notes = db.createObjectStore("notes", { keyPath: "id" });
          notes.createIndex("by-path", "path");
          notes.createIndex("by-updatedAt", "updatedAt");
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const row = await db.get("meta", key);
  return row?.value as T | undefined;
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.put("meta", { key, value });
}
