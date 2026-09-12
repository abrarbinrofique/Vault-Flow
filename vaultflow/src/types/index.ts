export type NoteKind = "markdown" | "drawing" | "sheet";

export interface Note {
  id: string;
  title: string;
  path: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  /** Optional; missing == "markdown" so existing IDB rows migrate implicitly. */
  kind?: NoteKind;
}

export interface Folder {
  id: string;
  name: string;
  path: string;
}

export interface LinkRecord {
  sourceId: string;
  targetTitle: string;
}

export type LinkIndex = {
  outbound: Record<string, string[]>;
  backlinks: Record<string, string[]>;
  tags: Record<string, string[]>;
};
