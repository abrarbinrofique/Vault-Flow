import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useVaultStore } from "../../stores/useVaultStore";

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
    <div className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <span className="text-sm font-semibold">Graph</span>
        <button
          onClick={onClose}
          className="text-xs opacity-70 hover:opacity-100"
        >
          Close ✕
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
            linkColor={() => "rgba(120,120,120,0.4)"}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const n = node as GNode & { x?: number; y?: number };
              if (n.x == null || n.y == null) return;
              const label = n.name;
              const fontSize = 12 / globalScale;
              ctx.beginPath();
              ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
              ctx.fillStyle = "#2563eb";
              ctx.fill();
              ctx.font = `${fontSize}px sans-serif`;
              ctx.fillStyle = "currentColor";
              ctx.fillText(label, n.x + 6, n.y + 3);
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
