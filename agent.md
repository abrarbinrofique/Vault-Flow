# VaultFlow - Agent Development Guide

## Project Overview
VaultFlow is a web-based Obsidian-inspired note-taking application with cloud sync capabilities.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Editor**: CodeMirror 6
- **Visualization**: D3.js
- **Cloud Storage**: Google Drive API v3
- **Local Storage**: IndexedDB via idb
- **State Management**: Zustand

---

## Best Practices to Follow

### 1. TypeScript Best Practices
- Enable `strict: true` in tsconfig.json
- Use `interface` for object shapes, `type` for unions/intersections
- Avoid `any` - use `unknown` with type guards instead
- Define explicit return types for functions
- Use discriminated unions for state management
- Leverage const assertions for literal types

```typescript
// Good: Discriminated union for async state
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }
```

### 2. Next.js 14 App Router Best Practices
- Use Server Components by default, Client Components only when needed
- Mark client components with `'use client'` directive
- Leverage `loading.tsx` for Suspense boundaries
- Use `error.tsx` for error boundaries
- Implement `not-found.tsx` for 404 states
- Use Route Groups `(group)` for layout organization
- Implement metadata API for SEO

```typescript
// layout.tsx - Server Component by default
export const metadata = {
  title: 'VaultFlow',
  description: 'Obsidian-inspired note-taking app',
}
```

### 3. State Management (Zustand) Best Practices
- Create separate stores for different domains
- Use selectors to prevent unnecessary re-renders
- Implement middleware for persistence/logging
- Use immer for complex state updates

```typescript
// Good: Selective subscription
const fileName = useStore((state) => state.activeFile?.name)

// Bad: Subscribe to entire store
const store = useStore()
```

### 4. CodeMirror 6 Best Practices
- Create extensions as separate modules
- Use compartments for dynamic configuration
- Implement custom decorations for wikilinks
- Debounce document updates
- Use StateField for custom state

### 5. Performance Best Practices
- Implement virtual scrolling for large lists (react-window or @tanstack/virtual)
- Use `useMemo` and `useCallback` for expensive computations
- Implement proper React keys (not array indices for dynamic lists)
- Lazy load heavy components (graph view, editor)
- Use Web Workers for search indexing
- Implement request deduplication for API calls

### 6. Google Drive API Best Practices
- Use incremental authorization
- Implement exponential backoff for rate limits
- Cache file metadata locally
- Use batch requests where possible
- Handle offline gracefully with queue system

### 7. IndexedDB Best Practices
- Use transactions properly
- Implement versioned schemas with migrations
- Create indexes for frequently queried fields
- Handle quota exceeded errors
- Use cursor iteration for large datasets

### 8. CSS/Tailwind Best Practices
- Use CSS variables for theming
- Implement dark mode with `dark:` variants
- Use `@apply` sparingly, prefer utility classes
- Create component-specific styles only when needed
- Use `clsx` or `cn` for conditional classes

### 9. Accessibility Best Practices
- Use semantic HTML elements
- Implement keyboard navigation
- Add ARIA labels where needed
- Ensure sufficient color contrast
- Support reduced motion preferences

### 10. Error Handling Best Practices
- Create custom error classes
- Implement error boundaries at strategic points
- Log errors with context (but not sensitive data)
- Show user-friendly error messages
- Implement retry mechanisms for transient failures

### 11. Testing Strategy (Recommended)
- Unit tests: Vitest for utility functions
- Component tests: React Testing Library
- E2E tests: Playwright
- Test coverage target: 80%+

### 12. Security Best Practices
- Sanitize markdown output (XSS prevention)
- Validate file paths (path traversal prevention)
- Use Content Security Policy headers
- Store tokens securely (memory for access, encrypted for refresh)
- Implement PKCE for OAuth flow

---

## Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Auth-related routes
│   │   └── callback/        # OAuth callback
│   ├── (main)/              # Main app routes
│   │   ├── layout.tsx       # Three-panel layout
│   │   └── page.tsx         # Main editor view
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Landing/storage selection
├── components/
│   ├── editor/              # CodeMirror components
│   │   ├── Editor.tsx
│   │   ├── Toolbar.tsx
│   │   └── extensions/      # CM6 extensions
│   ├── file-tree/           # File browser
│   │   ├── FileTree.tsx
│   │   ├── FileNode.tsx
│   │   └── ContextMenu.tsx
│   ├── graph/               # D3 graph view
│   │   └── GraphView.tsx
│   ├── panels/              # Layout panels
│   │   ├── LeftPanel.tsx
│   │   ├── RightPanel.tsx
│   │   └── ResizablePanel.tsx
│   ├── search/              # Search components
│   │   └── SearchModal.tsx
│   ├── sidebar/             # Sidebar components
│   │   ├── BacklinksPanel.tsx
│   │   ├── TagsPanel.tsx
│   │   └── DailyNotes.tsx
│   └── ui/                  # Shared UI components
│       ├── Button.tsx
│       ├── Modal.tsx
│       └── Tooltip.tsx
├── hooks/                   # Custom React hooks
│   ├── useAutoSave.ts
│   ├── useKeyboardShortcuts.ts
│   ├── useSearch.ts
│   └── useWikilinks.ts
├── lib/                     # Utilities and helpers
│   ├── storage/             # Storage adapters
│   │   ├── interface.ts     # StorageAdapter interface
│   │   ├── google-drive.ts  # Google Drive adapter
│   │   ├── local.ts         # IndexedDB adapter
│   │   └── index.ts         # Factory function
│   ├── markdown/            # Markdown utilities
│   │   ├── parser.ts        # Wikilink/tag extraction
│   │   └── renderer.ts      # Custom rendering
│   ├── search/              # Search implementation
│   │   └── index.ts
│   └── utils/               # General utilities
│       ├── cn.ts            # Class name helper
│       ├── debounce.ts
│       └── date.ts
├── stores/                  # Zustand stores
│   ├── vault.ts             # Vault/file state
│   ├── editor.ts            # Editor state
│   ├── ui.ts                # UI state
│   └── auth.ts              # Auth state
├── types/                   # TypeScript types
│   ├── vault.ts
│   ├── storage.ts
│   └── editor.ts
└── config/                  # App configuration
    └── constants.ts
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Components                      │
│  (Editor, FileTree, Graph, Search, Sidebar)              │
└─────────────────┬───────────────────────────────────────┘
                  │ Subscribe/Dispatch
                  ▼
┌─────────────────────────────────────────────────────────┐
│                   Zustand Stores                          │
│  (VaultStore, EditorStore, UIStore, AuthStore)           │
└─────────────────┬───────────────────────────────────────┘
                  │ Read/Write
                  ▼
┌─────────────────────────────────────────────────────────┐
│                 Storage Interface                         │
│              (StorageAdapter)                            │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│ GoogleDrive   │   │ LocalAdapter  │
│ Adapter       │   │ (IndexedDB)   │
└───────────────┘   └───────────────┘
```

---

## Implementation Order

### Phase 1: Foundation
1. Project scaffolding with Next.js 14
2. Tailwind configuration with dark theme
3. Basic three-panel layout
4. Storage interface definition
5. IndexedDB adapter (start with local-first)

### Phase 2: Core Editor
6. CodeMirror 6 integration
7. Basic markdown editing
8. Auto-save functionality
9. File creation/deletion

### Phase 3: File Management
10. File tree component
11. Context menus
12. Drag and drop

### Phase 4: Linking & Discovery
13. Wikilink parsing
14. Wikilink autocomplete
15. Backlinks panel
16. Tag extraction and panel

### Phase 5: Search & Navigation
17. Full-text search
18. Search UI modal
19. Keyboard shortcuts

### Phase 6: Cloud Sync
20. Google OAuth integration
21. Google Drive adapter
22. Sync conflict resolution

### Phase 7: Advanced Features
23. D3.js graph view
24. Daily notes
25. Calendar widget

### Phase 8: Polish
26. Loading states
27. Error boundaries
28. Animations
29. Accessibility audit

---

## Key Implementation Notes

### Wikilink Regex
```typescript
const WIKILINK_REGEX = /\[\[([^\]]+)\]\]/g
const TAG_REGEX = /#([a-zA-Z0-9_-]+)/g
```

### Auto-save Debounce
```typescript
const AUTO_SAVE_DELAY = 2000 // 2 seconds
```

### Graph View Limits
```typescript
const DEFAULT_NODE_LIMIT = 200
const MIN_NODE_SIZE = 5
const MAX_NODE_SIZE = 30
```

### Keyboard Shortcuts Map
```typescript
const SHORTCUTS = {
  'mod+n': 'newNote',
  'mod+k': 'search',
  'mod+g': 'graphView',
  'mod+e': 'togglePreview',
  'mod+\\': 'toggleSidebar',
} as const
```

---

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000/callback
```

---

## Git Workflow
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- Create feature branches from `main`
- Squash merge PRs

---

## Performance Targets
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Bundle size: < 500KB (initial load)
- Search response: < 100ms for 1000 notes

---

## Known Challenges & Solutions

### Challenge: CodeMirror SSR
**Solution**: Dynamic import with `ssr: false`
```typescript
const Editor = dynamic(() => import('@/components/editor/Editor'), {
  ssr: false,
  loading: () => <EditorSkeleton />
})
```

### Challenge: Large File Trees
**Solution**: Virtual scrolling with react-window
```typescript
import { FixedSizeList } from 'react-window'
```

### Challenge: Graph Performance
**Solution**: Canvas rendering for 200+ nodes, limit default view

### Challenge: Offline Support
**Solution**: Service Worker + IndexedDB cache layer

---

## Resources
- [Next.js 14 Docs](https://nextjs.org/docs)
- [CodeMirror 6 Docs](https://codemirror.net/docs/)
- [D3.js Force Layout](https://d3js.org/d3-force)
- [Google Drive API](https://developers.google.com/drive/api/v3/about-sdk)
- [Zustand](https://github.com/pmndrs/zustand)
- [idb Library](https://github.com/jakearchibald/idb)
