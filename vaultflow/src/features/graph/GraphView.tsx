import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useVaultStore } from "../../stores/useVaultStore";
import { useUiStore } from "../../stores/useUiStore";
import Icon from "../../components/Icon";

interface GNode {
  id: string;
  name: string;
  degree: number;
  kind: "note" | "daily";
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

  const palette = useMemo(() => {
    // Reread on theme change.
    return {
      bg: readCssVar("--vf-bg") || (theme === "dark" ? "#101115" : "#ffffff"),
      surface: readCssVar("--vf-surface"),
      dot:
        theme === "dark"
          ? "rgba(255,255,255,0.035)"
          : "rgba(0,0,0,0.05)",
      neutral: theme === "dark" ? "#5a6472" : "#9aa3ae",
      neutralStroke: theme === "dark" ? "#232830" : "#e2e5ea",
      accent: readCssVar("--vf-accent") || "#8b7cff",
      accentSoft:
        theme === "dark"
          ? "rgba(139,124,255,0.35)"
          : "rgba(109,92,245,0.35)",
      secondary: theme === "dark" ? "#5eb0b7" : "#2b8a8f", // daily notes
      label: theme === "dark" ? "#e5e7eb" : "#111827",
      labelDim: theme === "dark" ? "#4b525c" : "#c2c6cd",
      linkColor:
        theme === "dark" ? "rgba(200,200,200,0.18)" : "rgba(60,60,60,0.18)",
      linkHighlight: readCssVar("--vf-accent") || "#8b7cff",
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

    const nodes: GNode[] = Object.values(notes).map((n) => ({
      id: n.id,
      name: n.title,
      degree: degree.get(n.id) ?? 0,
      kind: n.path === "Daily" ? "daily" : "note",
    }));
    return { nodes, links };
  }, [notes, outbound]);

  // Compute neighbor sets for hover dimming.
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

  // Zoom to fit on mount and when data first arrives.
  useEffect(() => {
    if (!fgRef.current || data.nodes.length === 0) return;
    const t = setTimeout(() => fgRef.current?.zoomToFit(600, 80), 350);
    return () => clearTimeout(t);
  }, [data.nodes.length]);

  const radiusFor = (deg: number) => 3.5 + Math.min(6, Math.sqrt(deg) * 1.6);

  const colorFor = (n: GNode): { fill: string; stroke: string; label: string } => {
    const isActive = n.id === activeNoteId;
    const isHover = n.id === hoverId;
    const isNeighbor =
      hoverId && (hoverId === n.id || neighborsById.get(hoverId)?.has(n.id));

    if (hoverId && !isNeighbor && !isActive) {
      return {
        fill: palette.neutralStroke,
        stroke: palette.neutralStroke,
        label: palette.labelDim,
      };
    }
    if (isActive || isHover) {
      return { fill: palette.accent, stroke: palette.accent, label: palette.label };
    }
    if (n.kind === "daily") {
      return { fill: palette.secondary, stroke: palette.secondary, label: palette.label };
    }
    return {
      fill: palette.neutral,
      stroke: palette.neutralStroke,
      label: palette.label,
    };
  };

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
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--vf-muted)" }}>
          <span className="inline-flex items-center gap-1.5">
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: palette.accent,
              }}
            />
            Active / hovered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: palette.secondary,
              }}
            />
            Daily
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: palette.neutral,
              }}
            />
            Note
          </span>
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

      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        {/* Dot grid background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(${palette.dot} 1px, transparent 1px)`,
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
            linkColor={(link) => {
              const s = link.source as unknown as GNode;
              const t = link.target as unknown as GNode;
              if (hoverId && (s.id === hoverId || t.id === hoverId))
                return palette.linkHighlight;
              return palette.linkColor;
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
              const { fill, stroke, label } = colorFor(n);
              const r = radiusFor(n.degree);
              ctx.beginPath();
              ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
              ctx.fillStyle = fill;
              ctx.fill();
              ctx.lineWidth = 1.5 / globalScale;
              ctx.strokeStyle = stroke;
              ctx.stroke();

              const isFocus = n.id === hoverId || n.id === activeNoteId;
              if (globalScale > 0.7 || isFocus) {
                const fontSize = Math.max(11, 12 / globalScale);
                ctx.font = `${isFocus ? 600 : 400} ${fontSize}px ui-sans-serif, system-ui, -apple-system`;
                ctx.fillStyle = label;
                ctx.textBaseline = "middle";
                ctx.fillText(n.name, n.x + r + 4, n.y);
              }
            }}
            onNodeClick={(node) => {
              setActiveNote(String((node as GNode).id));
              onClose();
            }}
          />
        )}

        {/* Floating zoom controls */}
        <div
          className="absolute bottom-4 right-4 flex flex-col overflow-hidden"
          style={{
            background: "var(--vf-surface)",
            border: "1px solid var(--vf-border)",
            borderRadius: "var(--vf-radius)",
            boxShadow: "var(--vf-shadow-md)",
          }}
        >
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
