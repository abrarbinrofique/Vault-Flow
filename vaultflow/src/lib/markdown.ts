// Pure parsers for wikilinks and tags.
// Regexes are authoritative — do not change without updating CLAUDE.md.

const WIKILINK_RE = /(?<!!)\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;
const TAG_RE = /(?:^|\s)#([\w/-]+)/g;

export interface WikilinkMatch {
  title: string;
  alias?: string;
}

export function parseWikilinks(md: string): WikilinkMatch[] {
  const out: WikilinkMatch[] = [];
  WIKILINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK_RE.exec(md)) !== null) {
    const title = m[1].trim();
    if (!title) continue;
    const alias = m[2]?.trim();
    out.push(alias ? { title, alias } : { title });
  }
  return out;
}

export function parseTags(md: string): string[] {
  const seen = new Set<string>();
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_RE.exec(md)) !== null) {
    seen.add(m[1].toLowerCase());
  }
  return [...seen];
}
