import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useVaultStore } from "../../stores/useVaultStore";
import { useUiStore } from "../../stores/useUiStore";

const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

interface GNode {
  id: string;
  name: string;
}
interface GLink {
  source: string;
  target: string;
}

export default function GraphView({ onClose }: { onClose: () => void }) {
  const notes = useVaultStore((s) => s.notes);
  const outbound = useVaultStore((s) => s.linkIndex.outbound);
  const setActiveNote = useVaultStore((s) => s.setActiveNote);
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === "dark";
  const labelColor = isDark ? "#e5e7eb" : "#111827";
  const linkColor = isDark ? "rgba(200,200,200,0.35)" : "rgba(80,80,80,0.35)";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

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
    const nodes: GNode[] = Object.values(notes).map((n) => ({
      id: n.id,
      name: n.title,
    }));
    const links: GLink[] = [];
    for (const [sourceId, titles] of Object.entries(outbound)) {
      for (const t of titles) {
        const targetId = titleToId.get(t.toLowerCase());
        if (targetId && targetId !== sourceId) {
          links.push({ source: sourceId, target: targetId });
        }
      }
    }
    return { nodes, links };
  }, [notes, outbound]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ background: "var(--vf-bg)", color: "var(--vf-fg)" }}
    >
      <div
        className="flex items-center justify-between border-b px-4"
        style={{ height: 44, borderColor: "var(--vf-border)" }}
      >
        <span className="text-[13px] font-semibold tracking-tight">Graph</span>
        <button
          onClick={onClose}
          className="vf-icon-btn"
          aria-label="Close graph"
          title="Close"
        >
          <span style={{ display: "inline-flex" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </span>
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden">
        {size.w > 0 && (
          <ForceGraph2D
            width={size.w}
            height={size.h}
            graphData={data}
            nodeLabel="name"
            nodeRelSize={5}
            linkColor={() => linkColor}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const n = node as GNode & { x?: number; y?: number };
              if (n.x == null || n.y == null) return;
              const label = n.name;
              const fontSize = 12 / globalScale;
              ctx.beginPath();
              ctx.arc(n.x, n.y, 5, 0, Math.PI * 2);
              ctx.fillStyle = colorFor(n.id);
              ctx.fill();
              ctx.strokeStyle = isDark ? "#0a0a0a" : "#ffffff";
              ctx.lineWidth = 1.5 / globalScale;
              ctx.stroke();
              ctx.font = `${fontSize}px sans-serif`;
              ctx.fillStyle = labelColor;
              ctx.fillText(label, n.x + 7, n.y + 3);
            }}
            onNodeClick={(node) => {
              setActiveNote(String((node as GNode).id));
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}
