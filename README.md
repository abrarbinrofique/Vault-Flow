# VaultFlow

**A local-first, offline-capable, Obsidian-inspired knowledge base — with drawings, spreadsheets, and a live graph, all in your browser.**

Zero backend. Your notes never leave your device.

---

## ✨ Highlights

- **Obsidian-style live markdown** — headings, bold/italic, code blocks, task lists, tables, quotes, HR — rendered inline while staying fully editable (raw markdown is always the source of truth).
- **`[[Wikilinks]]`** with `[[` autocomplete, click-to-navigate, inline hints for existing titles, and automatic rewrite on rename.
- **Backlinks & unlinked mentions** with surrounding-context snippets.
- **`#tag` pill chips** in the editor, a filterable tag pane in the sidebar.
- **Full-text search (Ctrl+P)** — MiniSearch across title + body with fuzzy + prefix matching and highlighted snippets. Command palette also opens notes, creates notes, and toggles settings.
- **Interactive graph view** — force-directed, color-coded per top-level folder, cluster pattern, timeline "watch the vault grow" mode.
- **Excalidraw drawing notes** — a first-class note type. Persistent global shape library, `.excalidrawlib` import.
- **Spreadsheet notes** — editable grid (react-data-grid) with charts (bar / line / area / pie via Recharts).
- **Smart folders** — save any search + tag + recency filter as a live-updating sidebar section.
- **Note templates with variables** — `{{title}}`, `{{date}}`, `{{time}}`, `{{cursor}}`. Daily-note template auto-loaded.
- **Quick capture** (Ctrl+Shift+Space) — instant thought → Inbox note, without leaving your current note.
- **Universal export** — a single `.html` file or `.md` file per note. Full vault export as `.zip`.
- **Local folder sync** (File System Access API, Chromium) — connect a real folder on disk, notes become `.md` files, changes mirror both ways.
- **Themes, split panes, mobile-responsive, keyboard-driven.**

---

## 🧭 Storage roadmap

| Version | Storage | Sync | Notes |
| --- | --- | --- | --- |
| **v1 (current)** | Browser **IndexedDB** as source of truth | Optional live mirror to a **local folder** (Chromium File System Access API). Full-vault `.zip` export/import works in every browser. | Everything lives on your device. Nothing ever hits a server. |
| **v2 (planned)** | Same IndexedDB core + pluggable **StorageAdapters** | **Google Drive** sync so your vault follows you across machines. **Google Keep** import so existing quick notes flow in as VaultFlow notes. Optional shared vaults. | The `StorageAdapter` interface is already the contract; v2 adds new adapters without rewriting features. |

Design principle held across both versions: **your data belongs to you**. Even after cloud sync ships, the local copy stays the primary source.

---

## 🚀 Try it locally

Requires Node 20+.

```bash
git clone https://github.com/abrarbinrofique/Vault-Flow.git
cd Vault-Flow/vaultflow
npm install
npm run dev
```

Open `http://localhost:5173`. Chromium (Chrome / Edge / Brave / Arc) unlocks the local-folder sync feature. Firefox and Safari get the full app minus that one button.

### Scripts (all inside `vaultflow/`)

```bash
npm run dev         # Vite dev server (HMR)
npm run build       # tsc + vite build → dist/
npm run preview     # preview built output
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest (unit tests for pure logic)
```

---

## ⌨️ Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl` / `Cmd` + `P` | Command palette / search |
| `Ctrl` / `Cmd` + `Shift` + `Space` | Quick capture to Inbox |
| `Ctrl` / `Cmd` + `\` | Toggle sidebar |
| `Ctrl` / `Cmd` + `L` | Convert underlined text hint → `[[wikilink]]` |
| Click on `[[wikilink]]` | Open (or create) the target note |
| `Alt` + click on `[[wikilink]]` | Place cursor there without navigating |
| `Tab` / `Shift+Tab` inside a table | Jump between cells |
| `Enter` on last cell of a table | Add a new row |

---

## 🏗️ Architecture

```
vaultflow/
├── index.html
├── vite.config.ts
├── src/
│   ├── main.tsx            # entry
│   ├── App.tsx             # shell + shortcuts
│   ├── storage/
│   │   ├── StorageAdapter.ts   # the contract every backend implements
│   │   ├── IndexedDbAdapter.ts # v1 default backend
│   │   └── db.ts               # idb setup + meta helpers
│   ├── stores/             # Zustand: useVaultStore, useUiStore, useSmartStore
│   ├── features/
│   │   ├── editor/         # CodeMirror + live preview + tables + link hints
│   │   ├── filetree/       # sidebar, drag-and-drop between folders
│   │   ├── graph/          # react-force-graph + timeline + clusters
│   │   ├── drawing/        # Excalidraw (lazy chunk)
│   │   ├── sheet/          # react-data-grid + Recharts (lazy chunk)
│   │   ├── commandpalette/ # Ctrl+P
│   │   ├── capture/        # Quick capture
│   │   ├── templates/      # {{variable}} substitution
│   │   ├── smart/          # saved searches as folders
│   │   ├── folder/         # File System Access mirror + vault ZIP
│   │   ├── backlinks/      # linked + unlinked mentions
│   │   ├── tags/           # tag pane
│   │   └── dailynotes/
│   ├── lib/                # pure utilities (linkIndex, searchIndex, markdown, ...)
│   ├── components/         # icon + dialog primitives
│   ├── hooks/              # useMediaQuery
│   ├── types/              # Note, Folder, LinkIndex
│   └── styles/globals.css
```

### Why Vite (not Next.js)

VaultFlow is 100% client-side. SSR would fight CodeMirror, IndexedDB, and the Excalidraw canvas at every step. Vite gives us a lean SPA with zero SSR risk.

### The StorageAdapter contract (stable across versions)

```ts
export interface StorageAdapter {
  listFiles(): Promise<Note[]>;
  readFile(id: string): Promise<Note | null>;
  writeFile(note: Note): Promise<void>;
  deleteFile(id: string): Promise<void>;
  createFile(input: { title: string; path?: string; content?: string; kind?: NoteKind }): Promise<Note>;
}
```

Every feature talks to storage only through this interface. New adapters (Google Drive, native filesystem) plug in without a single feature-code change.

---

## 🧪 Tech stack

- **Vite 8** · **React 19** · **TypeScript 5.9** · **Tailwind CSS 4**
- **CodeMirror 6** — editor core (+ `@codemirror/lang-markdown`, `@lezer/markdown` for GFM)
- **Zustand 5** — narrow-selector state stores
- **idb 8** — IndexedDB wrapper
- **MiniSearch 7** — incremental full-text index
- **react-force-graph-2d** — the graph view
- **Excalidraw** — drawing notes (lazy-loaded chunk)
- **react-data-grid** + **Recharts** — sheet notes (lazy-loaded chunk)
- **date-fns** — daily-note formatting
- **marked** — markdown → HTML for exports
- **jszip** — vault ZIP export/import

---

## 🗺️ Roadmap

### v1 (shipped)
Everything above.

### v2 (next)
- **Google Drive sync** — a `GoogleDriveAdapter` implementing `StorageAdapter`. Notes live in Drive as `.md`, drawings as `.excalidraw.json`, sheets as JSON — all plain files you can open outside VaultFlow.
- **Google Keep / Notes import** — bring in existing quick captures as VaultFlow notes with tag preservation.
- **Sync conflict resolution** — three-way merge for concurrent edits.
- **Optional shared vaults** — collaborate on a folder with someone else's account.
- **Cross-device continuity** — start a note on laptop, finish on phone, same underlying file.

### Ideas being weighed
- Formulas in sheet notes (HyperFormula) for real Excel parity.
- Publish a note as a signed static page.
- End-to-end encryption for the Drive adapter.
- Local LLM assist (WebGPU) for search, tagging, summaries.

---

## 📜 License

MIT.

---

*Built by [@abrarbinrofique](https://github.com/abrarbinrofique).*
