import { marked } from "marked";
import type { Note } from "../types";

// eslint-disable-next-line no-control-regex
const UNSAFE_FS = /[<>:"/\\|?*\x00-\x1F]/g;
function safeFilename(title: string, fallback: string, ext: string): string {
  const base = title.replace(UNSAFE_FS, "_").trim() || fallback;
  return `${base}.${ext}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const WIKILINK_RE = /\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g;
const TAG_RE = /(^|\s)#([\w/-]+)/g;

/** Transform wikilinks and tags to inline spans in a chunk of already-safe text. */
function transformInlineText(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(WIKILINK_RE, (_m, title: string, alias?: string) => {
    return `<span class="wl">${escapeHtml((alias ?? title).trim())}</span>`;
  });
  out = out.replace(TAG_RE, (_m, pre: string, tag: string) => {
    return `${pre}<span class="tag">#${escapeHtml(tag)}</span>`;
  });
  return out;
}

const DANGEROUS_TAGS = new Set([
  "SCRIPT",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "STYLE",
  "LINK",
  "META",
]);

function sanitizeAndTransform(fragmentHtml: string): string {
  const doc = new DOMParser().parseFromString(fragmentHtml, "text/html");

  // Strip dangerous elements
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const toRemove: Element[] = [];
  let el = walker.nextNode() as Element | null;
  while (el) {
    if (DANGEROUS_TAGS.has(el.tagName)) toRemove.push(el);
    else {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const val = attr.value;
        if (name.startsWith("on")) el.removeAttribute(attr.name);
        else if (
          (name === "href" || name === "src") &&
          /^\s*javascript:/i.test(val)
        ) {
          el.removeAttribute(attr.name);
        }
      }
    }
    el = walker.nextNode() as Element | null;
  }
  for (const n of toRemove) n.remove();

  // Wikilink + tag transforms on text nodes outside code/pre
  const textWalker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textJobs: { node: Text; html: string }[] = [];
  let tn = textWalker.nextNode() as Text | null;
  while (tn) {
    let p = tn.parentElement;
    let insideCode = false;
    while (p) {
      if (p.tagName === "CODE" || p.tagName === "PRE") {
        insideCode = true;
        break;
      }
      p = p.parentElement;
    }
    if (!insideCode) {
      const raw = tn.nodeValue ?? "";
      const transformed = transformInlineText(raw);
      if (transformed !== escapeHtml(raw)) {
        textJobs.push({ node: tn, html: transformed });
      }
    }
    tn = textWalker.nextNode() as Text | null;
  }
  for (const { node, html } of textJobs) {
    const tmpl = doc.createElement("template");
    tmpl.innerHTML = html;
    node.parentNode?.replaceChild(tmpl.content, node);
  }

  return doc.body.innerHTML;
}

const CSS = `
:root {
  --fg: #111827;
  --muted: #6b7280;
  --border: #e5e7eb;
  --surface: #f8fafc;
  --surface-strong: #eef2f7;
  --accent: #6d5cf5;
  --code-bg: #f3f4f6;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--fg);
  background: #ffffff;
  line-height: 1.7;
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
}
main {
  max-width: 70ch;
  margin: 48px auto 96px;
  padding: 0 24px;
}
h1, h2, h3, h4, h5, h6 { color: var(--fg); font-weight: 700; letter-spacing: -0.01em; line-height: 1.25; margin: 1.6em 0 0.5em; }
h1 { font-size: 30px; margin-top: 0; }
h2 { font-size: 22px; }
h3 { font-size: 18px; }
h4 { font-size: 16px; }
h5 { font-size: 14.5px; color: var(--muted); }
h6 { font-size: 13.5px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
p { margin: 0.8em 0; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
strong { font-weight: 700; }
em { font-style: italic; }
hr { border: none; border-top: 1px solid var(--border); margin: 2em 0; }
blockquote {
  border-left: 3px solid var(--border);
  color: var(--muted);
  font-style: italic;
  margin: 1em 0;
  padding: 0.1em 0 0.1em 14px;
}
ul, ol { padding-left: 1.4em; margin: 0.6em 0; }
li { margin: 0.2em 0; }
li > input[type="checkbox"] { margin-right: 6px; vertical-align: -1px; accent-color: var(--accent); }
code {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
  background: var(--code-bg);
  padding: 1px 5px;
  border-radius: 4px;
}
pre {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13.5px;
  background: var(--surface);
  border-left: 3px solid var(--border);
  padding: 12px 14px;
  border-radius: 6px;
  overflow-x: auto;
  line-height: 1.55;
}
pre code { background: transparent; padding: 0; border-radius: 0; font-size: inherit; }
table { border-collapse: collapse; margin: 1em 0; width: 100%; }
th, td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; }
th { background: var(--surface); font-weight: 600; }
.wl {
  color: var(--accent);
  border-bottom: 1px dashed rgba(109, 92, 245, 0.5);
}
.tag {
  display: inline-block;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--accent);
  background: rgba(109, 92, 245, 0.12);
  line-height: 1.6;
  vertical-align: baseline;
}
.meta {
  color: var(--muted);
  font-size: 13px;
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
`;

marked.setOptions({ gfm: true, breaks: false });

export function noteToMarkdown(note: Note): {
  blob: Blob;
  filename: string;
} {
  const blob = new Blob([note.content], { type: "text/markdown;charset=utf-8" });
  return { blob, filename: safeFilename(note.title, note.id, "md") };
}

export function noteToHtml(note: Note): { blob: Blob; filename: string } {
  const bodyRaw = marked.parse(note.content, { async: false }) as string;
  const bodyHtml = sanitizeAndTransform(bodyRaw);
  const updated = new Date(note.updatedAt).toISOString().slice(0, 10);
  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(note.title)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>${escapeHtml(note.title)}</h1>
<div class="meta">Updated ${escapeHtml(updated)}${note.path ? ` · ${escapeHtml(note.path)}` : ""}</div>
${bodyHtml}
</main>
</body>
</html>
`;
  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  return { blob, filename: safeFilename(note.title, note.id, "html") };
}
