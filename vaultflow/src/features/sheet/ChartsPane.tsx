import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Icon from "../../components/Icon";
import type { ChartType, SheetChart, SheetData } from "./sheetModel";

const CHART_COLORS = [
  "#6d5cf5",
  "#5eb0b7",
  "#d9a24a",
  "#cf7d97",
  "#7ba6d2",
  "#a8c76b",
];

interface Props {
  data: SheetData;
  onUpdate: (id: string, patch: Partial<SheetChart>) => void;
  onDelete: (id: string) => void;
  toNumber: (v: unknown) => number | null;
}

export default function ChartsPane({ data, onUpdate, onDelete, toNumber }: Props) {
  return (
    <>
      {data.charts.map((chart) => (
        <ChartCard
          key={chart.id}
          chart={chart}
          data={data}
          onUpdate={(patch) => onUpdate(chart.id, patch)}
          onDelete={() => onDelete(chart.id)}
          toNumber={toNumber}
        />
      ))}
    </>
  );
}

function ChartCard({
  chart,
  data,
  onUpdate,
  onDelete,
  toNumber,
}: {
  chart: SheetChart;
  data: SheetData;
  onUpdate: (patch: Partial<SheetChart>) => void;
  onDelete: () => void;
  toNumber: (v: unknown) => number | null;
}) {
  const numeric = useMemo(
    () =>
      data.rows
        .map((r) => {
          const x = r[chart.xKey];
          const point: Record<string, number | string> = {
            [chart.xKey]: (x ?? "") as string,
          };
          let hasAny = false;
          for (const yk of chart.yKeys) {
            const n = toNumber(r[yk]);
            if (n !== null) {
              point[yk] = n;
              hasAny = true;
            }
          }
          return hasAny ? point : null;
        })
        .filter((p): p is Record<string, number | string> => p !== null),
    [data.rows, chart.xKey, chart.yKeys, toNumber],
  );

  return (
    <div
      className="overflow-hidden vf-panel"
      style={{ background: "var(--vf-bg)" }}
    >
      <div
        className="flex items-center justify-between px-3"
        style={{ height: 34, borderBottom: "1px solid var(--vf-border)" }}
      >
        <input
          value={chart.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="flex-1 bg-transparent text-[12.5px] font-semibold outline-none"
          style={{ color: "var(--vf-fg)" }}
        />
        <button
          className="vf-icon-btn"
          onClick={onDelete}
          aria-label="Delete chart"
          title="Delete chart"
          style={{ width: 22, height: 22 }}
        >
          <Icon name="trash" size={12} />
        </button>
      </div>
      <div style={{ height: 200, padding: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(chart.type, chart, numeric)}
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2" style={{ borderColor: "var(--vf-border)" }}>
        <label className="text-[10.5px] uppercase tracking-wider" style={{ color: "var(--vf-muted)" }}>
          Type
        </label>
        <select
          value={chart.type}
          onChange={(e) => onUpdate({ type: e.target.value as ChartType })}
          className="rounded px-1.5 py-0.5 text-[11.5px]"
          style={{
            background: "var(--vf-surface)",
            border: "1px solid var(--vf-border)",
            color: "var(--vf-fg)",
          }}
        >
          <option value="bar">Bar</option>
          <option value="line">Line</option>
          <option value="area">Area</option>
          <option value="pie">Pie</option>
        </select>
        <label className="text-[10.5px] uppercase tracking-wider" style={{ color: "var(--vf-muted)" }}>
          X
        </label>
        <select
          value={chart.xKey}
          onChange={(e) => onUpdate({ xKey: e.target.value })}
          className="rounded px-1.5 py-0.5 text-[11.5px]"
          style={{
            background: "var(--vf-surface)",
            border: "1px solid var(--vf-border)",
            color: "var(--vf-fg)",
          }}
        >
          {data.columns.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="text-[10.5px] uppercase tracking-wider" style={{ color: "var(--vf-muted)" }}>
          Y
        </label>
        <div className="flex flex-wrap gap-1">
          {data.columns
            .filter((c) => c.key !== chart.xKey)
            .map((c) => {
              const active = chart.yKeys.includes(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() =>
                    onUpdate({
                      yKeys: active
                        ? chart.yKeys.filter((k) => k !== c.key)
                        : [...chart.yKeys, c.key],
                    })
                  }
                  className="rounded px-2 text-[11px]"
                  style={{
                    height: 20,
                    background: active
                      ? "var(--vf-accent)"
                      : "var(--vf-surface)",
                    color: active ? "var(--vf-on-accent)" : "var(--vf-fg-secondary)",
                    border: "1px solid",
                    borderColor: active ? "transparent" : "var(--vf-border)",
                  }}
                >
                  {c.name}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function renderChart(
  type: ChartType,
  chart: SheetChart,
  data: Record<string, number | string>[],
): React.ReactElement {
  const common = { data };
  switch (type) {
    case "line":
      return (
        <LineChart {...common}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
          <XAxis dataKey={chart.xKey} fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Legend />
          {chart.yKeys.map((yk, i) => (
            <Line
              key={yk}
              type="monotone"
              dataKey={yk}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      );
    case "area":
      return (
        <AreaChart {...common}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
          <XAxis dataKey={chart.xKey} fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Legend />
          {chart.yKeys.map((yk, i) => (
            <Area
              key={yk}
              type="monotone"
              dataKey={yk}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              fillOpacity={0.35}
            />
          ))}
        </AreaChart>
      );
    case "pie": {
      const yk = chart.yKeys[0];
      return (
        <PieChart>
          <Tooltip />
          <Legend />
          <Pie
            data={data}
            dataKey={yk}
            nameKey={chart.xKey}
            outerRadius={70}
            innerRadius={0}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      );
    }
    default:
      return (
        <BarChart {...common}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
          <XAxis dataKey={chart.xKey} fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Legend />
          {chart.yKeys.map((yk, i) => (
            <Bar
              key={yk}
              dataKey={yk}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
            />
          ))}
        </BarChart>
      );
  }
}
