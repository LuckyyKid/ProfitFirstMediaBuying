// KPI row with hairline-separated columns (NO boxes). Reference 2b top.
// Grand number in JetBrains Mono 300, small delta below with status dot.

import { StatusDot, Status } from "./primitives";

export type MetricCell = {
  label: string;                 // "CONTRIBUTION"
  value: string;                 // "41 210 $"
  delta?: string;                // "+1,0 %"
  status?: Status;               // "good" | "watch" | "bad" | "missing"
  valueColor?: string;           // override text color (e.g. red for "AD SPEND" alert)
};

export function MetricColumns({ cells }: { cells: MetricCell[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`,
        gap: 0,
      }}
    >
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            padding: "6px 24px",
            borderLeft: i === 0 ? "none" : "1px solid rgba(148, 170, 215, 0.12)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div className="microlabel" style={{ fontSize: 10, letterSpacing: "0.24em" }}>
            {c.label}
          </div>
          <div
            className="font-data"
            style={{
              fontSize: 26,
              fontWeight: 300,
              color: c.valueColor ?? "#eef2fa",
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
            }}
          >
            {c.value}
          </div>
          {c.status && c.delta && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusDot status={c.status} label={c.delta} showLabel={true} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
