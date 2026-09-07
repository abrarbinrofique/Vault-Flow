import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useVaultStore } from "../../stores/useVaultStore";
import { useUiStore } from "../../stores/useUiStore";
import Icon from "../../components/Icon";

// Muted palette that reads on both themes; deterministic per folder.
const PALETTE = [
  "#9d8bd0", // violet
  "#6fb8ae", // teal
  "#d9a24a", // amber
  "#cf7d97", // rose
  "#7ba6d2", // sky
  "#a8c76b", // lime
  "#d68a52", // orange
  "#8a92c9", // indigo
  "#c78bb0", // orchid
  "#7fb59c", // sage
];

const DAILY_HUE = "#5eb0b7"; // fixed teal, regardless of folder
const ROOT_HUE_LIGHT = "#94a3b8"; // slate-400
const ROOT_HUE_DARK = "#7d8695";
const ACTIVE_HUE_FALLBACK = "#8b7cff";

function hashIndex(s: string, mod: number): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h % mod;
}

function topFolder(path: string): string {
  if (!path) return "";
  const i = path.indexOf("/");
  return i === -1 ? path : path.slice(0, i);
}

interface GNode {
  id: string;
  name: string;
  degree: number;
  kind: "note" | "daily";
  group: string; // top-level folder, "" for root
  color: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}
interface GLink {
  source: string;
  target: string;
}

interface FGRef {
  zoomToFit: (ms: number, padding: number) => void;
  zoom: (factor?: number, ms?: number) => number | void;
  centerAt: (x?: number, y?: number, ms?: number) => void;
}

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Hex → rgba
function withAlpha(hex: string, a: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function GraphView({ onClose }: { onClose: () => void }) {
  const notes = useVaultStore((s) => s.notes);
  const outbound = useVaultStore((s) => s.linkIndex.outbound);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const activeNoteId = useVaultStore((s) => s.activeNoteId);
  const theme = useUiStore((s) => s.theme);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fgRef = useRef<FGRef | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [mode, setMode] = useState<"cursor" | "hand">("cursor");

  const chrome = useMemo(() => {
    return {
      dot:
        theme === "dark"
          ? "rgba(255,255,255,0.035)"
          : "rgba(0,0,0,0.05)",
      accent: readCssVar("--vf-accent") || ACTIVE_HUE_FALLBACK,
      label: theme === "dark" ? "#e5e7eb" : "#111827",
      labelDim: theme === "dark" ? "#7a8492" : "#95a0af",
      linkColor:
        theme === "dark" ? "rgba(200,200,200,0.14)" : "rgba(60,60,60,0.14)",
      rootHue: theme === "dark" ? ROOT_HUE_DARK : ROOT_HUE_LIGHT,
    };
  }, [theme]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Deterministic folder → color mapping. Assign palette slots in order of
  // discovery so the top-N legend is stable-ish across reloads.
  const folderColor = useMemo(() => {
    const m = new Map<string, string>();
    const distinctFolders = new Set<string>();
    for (const n of Object.values(notes)) {
      const f = topFolder(n.path);
      if (f && f !== "Daily") distinctFolders.add(f);
    }
    // Sort alphabetically for stability regardless of iteration order.
    for (const f of [...distinctFolders].sort()) {
      m.set(f, PALETTE[hashIndex(f, PALETTE.length)]);
    }
    return m;
  }, [notes]);

  const data = useMemo(() => {
    const titleToId = new Map<string, string>();
    for (const n of Object.values(notes)) titleToId.set(n.title.toLowerCase(), n.id);

    const degree = new Map<string, number>();
    const links: GLink[] = [];
    for (const [sourceId, titles] of Object.entries(outbound)) {
      for (const t of titles) {
        const targetId = titleToId.get(t.toLowerCase());
        if (targetId && targetId !== sourceId) {
          links.push({ source: sourceId, target: targetId });
          degree.set(sourceId, (degree.get(sourceId) ?? 0) + 1);
          degree.set(targetId, (degree.get(targetId) ?? 0) + 1);
        }
      }
    }

    const nodes: GNode[] = Object.values(notes).map((n) => {
      const group = topFolder(n.path);
      const kind: "note" | "daily" = group === "Daily" ? "daily" : "note";
      let color: string;
      if (kind === "daily") color = DAILY_HUE;
      else if (!group) color = chrome.rootHue;
      else color = folderColor.get(group) ?? chrome.rootHue;
      return {
        id: n.id,
        name: n.title,
        degree: degree.get(n.id) ?? 0,
        kind,
        group,
        color,
      };
    });
    return { nodes, links };
  }, [notes, outbound, folderColor, chrome.rootHue]);

  const neighborsById = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const n of data.nodes) m.set(n.id, new Set());
    for (const l of data.links) {
      const s = typeof l.source === "string" ? l.source : (l.source as unknown as GNode).id;
      const t = typeof l.target === "string" ? l.target : (l.target as unknown as GNode).id;
      m.get(s)?.add(t);
      m.get(t)?.add(s);
    }
    return m;
  }, [data]);

  useEffect(() => {
    if (!fgRef.current || data.nodes.length === 0) return;
    const t = setTimeout(() => fgRef.current?.zoomToFit(600, 80), 350);
    return () => clearTimeout(t);
  }, [data.nodes.length]);

  // In cursor mode we disable the library's built-in pan/zoom (which is a
  // single d3-zoom behavior) and wire our own wheel-to-zoom so users still
  // get smooth scroll-zoom without accidental panning on empty space.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mode !== "cursor") return;
    const onWheel = (e: WheelEvent) => {
      if (!fgRef.current) return;
      e.preventDefault();
      const current = (fgRef.current.zoom() as number) || 1;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      fgRef.current.zoom(current * factor, 120);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mode]);

  const radiusFor = (deg: number, active: boolean) =>
    (active ? 5 : 3.5) + Math.min(6, Math.sqrt(deg) * 1.6);

  // Legend groups: top-level folders by size + Daily + Root + Active.
  const legend = useMemo(() => {
    const counts = new Map<string, number>();
    let root = 0;
    let daily = 0;
    for (const n of data.nodes) {
      if (n.kind === "daily") daily += 1;
      else if (!n.group) root += 1;
      else counts.set(n.group, (counts.get(n.group) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 8);
    const others = sorted
      .slice(8)
      .reduce((acc, [, c]) => acc + c, 0);
    return { top, others, root, daily };
  }, [data.nodes]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: "var(--vf-bg)", color: "var(--vf-fg)" }}
    >
      <div
        className="flex items-center justify-between border-b px-4"
        style={{
          height: 44,
          borderColor: "var(--vf-border)",
          background: "var(--vf-topbar)",
        }}
      >
        <span className="text-[13px] font-semibold tracking-tight">Graph</span>
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
          style={{ color: "var(--vf-muted)" }}
        >
          <LegendChip color={chrome.accent} label="Active" />
          {legend.daily > 0 && <LegendChip color={DAILY_HUE} label={`Daily (${legend.daily})`} />}
          {legend.root > 0 && <LegendChip color={chrome.rootHue} label={`Root (${legend.root})`} />}
          {legend.top.map(([folder, count]) => (
            <LegendChip
              key={folder}
              color={folderColor.get(folder) ?? chrome.rootHue}
              label={`${folder} (${count})`}
            />
          ))}
          {legend.others > 0 && (
            <LegendChip color={chrome.rootHue} label={`others (${legend.others})`} />
          )}
        </div>
        <button
          onClick={onClose}
          className="vf-icon-btn"
          aria-label="Close graph"
          title="Close"
        >
          <Icon name="close" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
        style={{ cursor: mode === "hand" ? "grab" : "default" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(${chrome.dot} 1px, transparent 1px)`,
            backgroundSize: "22px 22px",
          }}
        />
        {size.w > 0 && (
          <ForceGraph2D
            ref={fgRef as unknown as never}
            width={size.w}
            height={size.h}
            graphData={data}
            backgroundColor="rgba(0,0,0,0)"
            nodeRelSize={5}
            cooldownTicks={80}
            enableZoomInteraction={mode === "hand"}
            enablePanInteraction={mode === "hand"}
            enableNodeDrag={true}
            linkColor={(link) => {
              const s = link.source as unknown as GNode;
              const t = link.target as unknown as GNode;
              if (hoverId && (s.id === hoverId || t.id === hoverId)) {
                const hovered = s.id === hoverId ? s : t;
                return withAlpha(hovered.color, 0.55);
              }
              return chrome.linkColor;
            }}
            linkWidth={(link) => {
              const s = link.source as unknown as GNode;
              const t = link.target as unknown as GNode;
              return hoverId && (s.id === hoverId || t.id === hoverId) ? 1.6 : 1;
            }}
            onNodeHover={(n) => setHoverId(n ? (n as GNode).id : null)}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const n = node as GNode;
              if (n.x == null || n.y == null) return;

              const isActive = n.id === activeNoteId;
              const isHover = n.id === hoverId;
              const isNeighbor =
                hoverId != null &&
                (hoverId === n.id || neighborsById.get(hoverId)?.has(n.id));
              const isDimmed = hoverId != null && !isNeighbor && !isActive;
              const isOrphan = n.degree === 0;

              // Opacity: hover-dim → 0.22; orphan (no hover) → 0.55; else 1.
              let alpha = 1;
              if (isDimmed) alpha = 0.22;
              else if (isOrphan && !isHover && !isActive) alpha = 0.55;

              const fill = isActive || isHover ? chrome.accent : n.color;
              const r = radiusFor(n.degree, isActive);

              ctx.globalAlpha = alpha;

              // Node
              ctx.beginPath();
              ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
              ctx.fillStyle = fill;
              ctx.fill();
              // Halo ring for active
              if (isActive) {
                ctx.lineWidth = 2 / globalScale;
                ctx.strokeStyle = withAlpha(chrome.accent, 0.35);
                ctx.beginPath();
                ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
                ctx.stroke();
              }

              // Label
              const isFocus = isHover || isActive;
              if (globalScale > 0.7 || isFocus) {
                const fontSize = Math.max(11, 12 / globalScale);
                ctx.font = `${isFocus ? 600 : 400} ${fontSize}px ui-sans-serif, system-ui, -apple-system`;
                ctx.fillStyle = isDimmed ? chrome.labelDim : chrome.label;
                ctx.textBaseline = "middle";
                ctx.fillText(n.name, n.x + r + 4, n.y);
              }

              ctx.globalAlpha = 1;
            }}
            onNodeClick={(node) => {
              setActiveNote(String((node as GNode).id));
              onClose();
            }}
          />
        )}

        <div
          className="absolute top-4 right-4 flex flex-col overflow-hidden"
          style={{
            background: "var(--vf-surface)",
            border: "1px solid var(--vf-border)",
            borderRadius: "var(--vf-radius)",
            boxShadow: "var(--vf-shadow-md)",
          }}
        >
          <button
            className="vf-icon-btn"
            style={{
              borderRadius: 0,
              color:
                mode === "cursor" ? "var(--vf-accent)" : "var(--vf-muted)",
            }}
            onClick={() => setMode("cursor")}
            aria-label="Cursor mode"
            title="Cursor — drag nodes only"
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4l7 16 2-7 7-2z" />
            </svg>
          </button>
          <div style={{ height: 1, background: "var(--vf-border)" }} />
          <button
            className="vf-icon-btn"
            style={{
              borderRadius: 0,
              color: mode === "hand" ? "var(--vf-accent)" : "var(--vf-muted)",
            }}
            onClick={() => setMode("hand")}
            aria-label="Pan mode"
            title="Hand — drag canvas to pan"
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 11V6a1.5 1.5 0 1 1 3 0v4M9 10V4.5a1.5 1.5 0 1 1 3 0V10M12 10V5a1.5 1.5 0 1 1 3 0v6M15 11V7.5a1.5 1.5 0 1 1 3 0V15a6 6 0 0 1-6 6h-2c-2 0-3-1-4-2l-4-6c-.5-1 .5-2 1.5-1.5L6 13" />
            </svg>
          </button>
          <div style={{ height: 1, background: "var(--vf-border)" }} />
          <button
            className="vf-icon-btn"
            style={{ borderRadius: 0 }}
            onClick={() => fgRef.current?.zoom((fgRef.current.zoom() as number) * 1.4, 200)}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <Icon name="plus" size={15} />
          </button>
          <div style={{ height: 1, background: "var(--vf-border)" }} />
          <button
            className="vf-icon-btn"
            style={{ borderRadius: 0 }}
            onClick={() => fgRef.current?.zoom((fgRef.current.zoom() as number) / 1.4, 200)}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            >
              <path d="M5 12h14" />
            </svg>
          </button>
          <div style={{ height: 1, background: "var(--vf-border)" }} />
          <button
            className="vf-icon-btn"
            style={{ borderRadius: 0 }}
            onClick={() => fgRef.current?.zoomToFit(400, 80)}
            aria-label="Zoom to fit"
            title="Zoom to fit"
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
        }}
      />
      <span className="truncate" style={{ maxWidth: 120 }}>
        {label}
      </span>
    </span>
  );
}
