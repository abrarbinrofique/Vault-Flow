import JSZip from "jszip";
import type { Note } from "../types";
import { format } from "date-fns";

const UNSAFE = /[<>:"/\\|?*\x00-\x1F]/g; // eslint-disable-line no-control-regex
function safeSegment(s: string): string {
  return s.replace(UNSAFE, "_").trim();
}

function fileName(title: string, fallback: string): string {
  const t = safeSegment(title) || fallback;
  return `${t}.md`;
}

export async function exportVaultAsZip(notes: Note[]): Promise<{
  blob: Blob;
  filename: string;
}> {
  const zip = new JSZip();
  for (const n of notes) {
    const dir = n.path ? n.path.split("/").filter(Boolean).map(safeSegment).join("/") : "";
    const path = dir ? `${dir}/${fileName(n.title, n.id)}` : fileName(n.title, n.id);
    zip.file(path, n.content, {
      date: new Date(n.updatedAt),
    });
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `vaultflow-${format(new Date(), "yyyy-MM-dd-HHmm")}.zip`;
  return { blob, filename };
}

export interface ImportedFromZip {
  title: string;
  path: string;
  content: string;
  updatedAt: number;
}

export async function importVaultFromZip(file: File): Promise<ImportedFromZip[]> {
  const zip = await JSZip.loadAsync(file);
  const out: ImportedFromZip[] = [];
  const files: { relativePath: string; entry: JSZip.JSZipObject }[] = [];
  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    if (!relativePath.toLowerCase().endsWith(".md")) return;
    files.push({ relativePath, entry });
  });
  for (const { relativePath, entry } of files) {
    const content = await entry.async("string");
    const segs = relativePath.split("/").filter(Boolean);
    const name = segs.pop() ?? "untitled.md";
    const title = name.replace(/\.md$/i, "");
    const path = segs.join("/");
    out.push({
      title,
      path,
      content,
      updatedAt: entry.date ? entry.date.getTime() : Date.now(),
    });
  }
  return out;
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
