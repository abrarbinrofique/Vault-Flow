import { format } from "date-fns";

const TEMPLATES_FOLDER = "Templates";
const CURSOR_TOKEN = "{{cursor}}";
const VAR_RE = /\{\{\s*([a-zA-Z]+)(?::([^{}]+))?\s*\}\}/g;

export const TEMPLATES_PATH = TEMPLATES_FOLDER;

export function isTemplatePath(path: string | undefined | null): boolean {
  if (!path) return false;
  return path === TEMPLATES_FOLDER || path.startsWith(TEMPLATES_FOLDER + "/");
}

export interface SubstituteContext {
  title: string;
  now?: Date;
}

export interface SubstituteResult {
  content: string;
  cursor: number | null;
}

/**
 * Substitute {{title}}, {{date}}, {{time}}, {{date:FMT}}, {{time:FMT}} in the
 * template body. Unknown variables are left as-is. Handles {{cursor}} by
 * removing the first occurrence and reporting its offset in the resulting
 * string.
 */
export function substituteTemplate(
  template: string,
  ctx: SubstituteContext,
): SubstituteResult {
  const now = ctx.now ?? new Date();

  const replaced = template.replace(VAR_RE, (match, nameRaw: string, arg?: string) => {
    const name = nameRaw.toLowerCase();
    const fmt = arg?.trim();
    switch (name) {
      case "title":
        return ctx.title;
      case "date":
        return format(now, fmt ?? "yyyy-MM-dd");
      case "time":
        return format(now, fmt ?? "HH:mm");
      default:
        return match;
    }
  });

  const cursorIdx = replaced.indexOf(CURSOR_TOKEN);
  if (cursorIdx === -1) {
    return { content: replaced, cursor: null };
  }
  const content =
    replaced.slice(0, cursorIdx) +
    replaced.slice(cursorIdx + CURSOR_TOKEN.length);
  return { content, cursor: cursorIdx };
}
