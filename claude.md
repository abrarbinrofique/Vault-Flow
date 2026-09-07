 CLAUDE.md — VaultFlow

## Project Overview & Vision
VaultFlow is a web-based, local-first, offline-capable, Obsidian-inspired note-taking app.
Notes are plain Markdown. Notes link to each other with wikilinks `[[Note Name]]`, are
organized in folders, tagged with `#tags`, searchable, and visualized in an interactive graph.
All data is stored locally in the browser (IndexedDB) first. Cloud sync (Google Drive) is a
LATER phase and MUST NOT be built before Phase 5. The storage layer is abstracted so new
backends (Google Drive, local folder) can be added without rewriting features.

## Tech Stack (exact versions — do not upgrade majors without asking)
- Build tool: Vite 8.2.2 (React SPA, NO SSR)
- UI: React 19.2.8 + react-dom 19.2.8, TypeScript 7.0.2
- Styling: Tailwind CSS 4.3.3 + @tailwindcss/vite 4.3.3 (CSS-first config, no tailwind.config.js needed)
- State: Zustand 5.0.15
- Local storage: IndexedDB via idb 8.0.3
- Editor: codemirror 6.0.2 with @codemirror/state 6.7.1, @codemirror/view 6.43.9,
  @codemirror/lang-markdown 6.5.0, @codemirror/autocomplete 6.20.3, @codemirror/commands 6.10.4,
  @lezer/markdown 1.7.2
- Graph: react-force-graph-2d 1.29.1
- Search: minisearch 7.2.0
- Dates (daily notes): date-fns 4.4.0
- Routing (optional): react-router-dom 7.18.3
NOTE: If any exact version has a peer-dependency conflict, pin to the nearest working version and
tell me — do NOT silently bump a major version. If TypeScript 7.0.x causes tooling friction, fall
back to the latest TypeScript 5.x and tell me.

## Why Vite and not Next.js (IMPORTANT context)
The previous attempt used Next.js and failed. VaultFlow is 100% client-side; SSR causes
"window is not defined", hydration errors, and forces fragile dynamic(ssr:false) wrappers around
CodeMirror/IndexedDB/graph. Vite has no SSR, so those bugs cannot happen. Do not reintroduce SSR.

## Project Structure

vaultflow/ index.html vite.config.ts tsconfig.json src/ main.tsx # React entry App.tsx # app shell / layout styles/globals.css # @import "tailwindcss"; storage/ StorageAdapter.ts # interface (contract) IndexedDbAdapter.ts # Phase 1 implementation db.ts # idb openDB + schema/migrations (GoogleDriveAdapter.ts # Phase 5 only) stores/ useVaultStore.ts # notes, folders, active note useUiStore.ts # theme, panels, command palette features/ editor/ # CodeMirror wrapper + extensions filetree/ # sidebar tree wikilinks/ # parser, autocomplete, link index backlinks/ # backlinks panel tags/ # tag pane search/ # MiniSearch index + UI graph/ # react-force-graph view commandpalette/ # Ctrl+P dailynotes/ # daily note command lib/ markdown.ts # parse wikilinks/tags linkIndex.ts # build/maintain link graph debounce.ts types/ index.ts # Note, Folder, LinkIndex, Tag types


## Core Architecture

### Data model (types/index.ts)
```ts
export interface Note {
  id: string;              // stable uuid, never changes on rename
  title: string;           // display name (used for [[wikilinks]])
  path: string;            // folder path, e.g. "Projects/Ideas"
  content: string;         // raw markdown (source of truth)
  createdAt: number;
  updatedAt: number;
}
export interface Folder { id: string; name: string; path: string; }
export interface LinkRecord { sourceId: string; targetTitle: string; }  // resolved lazily
export type LinkIndex = {
  outbound: Record<string, string[]>;   // noteId -> [targetTitle,...]
  backlinks: Record<string, string[]>;  // lowercased title -> [sourceNoteId,...]
  tags: Record<string, string[]>;       // tag -> [noteId,...]
};
```
Wikilinks are stored as titles inside markdown (source of truth), resolved to notes at index time.
This makes renames cheap for the target (backlinks are keyed by title, resolved live) — but see
rename rule below for updating the raw text of links when a title changes.

### StorageAdapter interface (the contract — DO NOT break its shape)
```ts
export interface StorageAdapter {
  listFiles(): Promise<Note[]>;
  readFile(id: string): Promise<Note | null>;
  writeFile(note: Note): Promise<void>;       // create or update (upsert)
  deleteFile(id: string): Promise<void>;
  createFile(input: { title: string; path?: string; content?: string }): Promise<Note>;
}
```
- Every feature talks to storage ONLY through this interface, never to idb directly.
- IndexedDbAdapter is the only implementation in Phases 1–4.
- GoogleDriveAdapter (Phase 5) implements the SAME interface. No feature code should change.

### IndexedDB schema (storage/db.ts)
```ts
// db version 1
// store "notes" keyPath "id"; indexes: by-path, by-updatedAt
// store "meta"  keyPath "key"  (settings, theme, lastOpenedNoteId)
```
- Open DB inside idb `openDB('vaultflow', 1, { upgrade(db){...} })`.
- All schema/index creation happens ONLY in the `upgrade` callback.
- Bump the version number for any schema change and add a migration branch. Never edit stores outside upgrade.

### Link index (lib/linkIndex.ts)
- Parse each note's markdown for `[[Title]]` (and `[[Title|alias]]`) and `#tag`.
- Wikilink regex: `/(?<!!)\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/g` ; tag regex: `/(?:^|\s)#([\w/-]+)/g`.
- Maintain LinkIndex incrementally: on note save, recompute only that note's outbound links/tags,
  then update the global backlinks/tags maps for the changed keys. Do NOT rebuild the whole index on every keystroke.
- Backlinks for a note = linkIndex.backlinks[note.title.toLowerCase()].
- Rebuild full index once on app load from listFiles().
- On rename: update the target's title, then rewrite raw `[[oldTitle]]` occurrences to `[[newTitle]]`
  in all source notes returned by backlinks, and re-run the incremental index for each edited note.

## Critical Rules & Known Pitfalls

### SSR / environment (DO / DON'T)
- DO keep this a pure client SPA. There is no server.
- DON'T add Next.js, SSR, RSC, or server components.
- DON'T access `window`, `document`, `indexedDB`, or `localStorage` at module top-level in a way that
  runs during import in tests; guard where needed.

### CodeMirror 6 (IMPORTANT — this is where the last build broke)
- DO create the EditorView exactly once inside a `useEffect(() => {...}, [])` and call
  `view.destroy()` in the cleanup. Store the view in a ref.
- DON'T recreate the EditorView on every render or on every prop/value change. That causes cursor
  jumps, lost focus, and re-render loops.
- DO define extensions OUTSIDE the component or in `useMemo` with stable deps.
- DO push external content changes with `view.dispatch({changes:{from:0,to:view.state.doc.length,insert:value}})`
  AND guard against loops: compare `view.state.doc.toString() === value` before dispatching.
- DO use a debounced onChange (~300–500ms) that writes to the store/storage; DON'T write to IndexedDB on every keystroke.
- Treat raw markdown as the source of truth. Obsidian-style live-preview (hiding syntax via decorations)
  is HARD (cursor drift, layout shift) — implement plain markdown editing first; live preview is Phase 4 polish, not Phase 1.

### IndexedDB (DO / DON'T)
- DO go through StorageAdapter only.
- DO debounce autosave; DO keep transactions short and focused.
- DON'T open multiple DB connections; open once and reuse.
- DON'T create/alter object stores outside the `upgrade` callback.

### Zustand (DO / DON'T)
- DO select narrow slices: `useVaultStore(s => s.activeNoteId)`.
- DON'T destructure the whole store `useVaultStore(s => ({...}))` without `useShallow` — it re-renders on every change.
- DO group actions and use `useShallow` from `zustand/react/shallow` when selecting multiple values.
- DON'T store the CodeMirror EditorView instance in Zustand; keep it in a component ref.

### General
- Keep components small and single-purpose (target < ~150 lines).
- No feature reaches into another feature's internals; share via stores and lib/.

## Coding Conventions
- TypeScript strict mode on; no `any` unless justified with a comment.
- Functional components + hooks only.
- Tailwind utility classes for styling; dark/light via a `data-theme` attribute or `dark:` variant.
- File names: PascalCase for components, camelCase for utilities.
- Prefer pure functions in lib/ that are unit-testable without the DOM.

## Development Workflow (YOU MUST follow this)
1. Work in small increments — one feature/subtask at a time.
2. After EVERY change run, in order: `npm run typecheck`, `npm run lint`, `npm run build`.
3. Fix ALL type/lint/build errors before moving on. Do not accumulate errors.
4. Verify in the browser (`npm run dev`) that the feature actually works before starting the next.
5. Do NOT start a new phase until the current phase's acceptance checklist passes.
6. Ask before big architectural changes (new library, changing StorageAdapter shape, adding a router).
7. Commit with git after each working, verified increment.

## Testing Approach
- Unit-test pure logic with Vitest: wikilink parser, tag parser, link index build/update, debounce.
- Manual browser verification for UI features against each phase's acceptance checklist.
- Minimum before declaring a phase done: typecheck + lint + build pass AND checklist verified in browser.

## Phased Feature Roadmap
- Phase 1 — Foundation: Vite+TS+Tailwind scaffold; StorageAdapter + IndexedDbAdapter + idb schema;
  Zustand vault store; file-tree sidebar (folders + notes); create/rename/delete note; CodeMirror
  plain-markdown editor; debounced autosave; theme toggle stub.
  Acceptance: create a note, edit it, refresh the page — content persists. Create folders, rename, delete work.
- Phase 2 — Links & tags: wikilink parsing + `[[` autocomplete (suggest existing titles); clicking a
  wikilink opens/creates the target note; backlinks panel; `#tag` parsing + tag pane filtering; incremental link index.
- Phase 3 — Find & navigate: full-text search with MiniSearch (title + body, fuzzy/prefix); command
  palette (Ctrl+P) for quick open + commands; interactive graph view with react-force-graph-2d (clickable nodes open notes).
- Phase 4 — Polish: dark/light themes finalized; daily notes (date-fns); Obsidian-style live preview
  decorations in the editor; split panes if feasible; unlinked mentions if feasible.
- Phase 5 — Cloud sync (LATER): GoogleDriveAdapter implementing StorageAdapter; sync/merge strategy;
  optional File System Access API local-folder adapter (Chromium only, behind capability check).

## Commands
```bash
npm run dev         # vite dev server
npm run build       # tsc typecheck + vite production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run test        # vitest
```
(Ensure package.json scripts match these names.)