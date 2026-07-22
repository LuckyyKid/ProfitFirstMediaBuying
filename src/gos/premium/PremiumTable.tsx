// Premium table — hairline row separators, mono uppercase 9px headers,
// no zebra. Alert rows get a subtle lateral red gradient. Reference 2b.

import { ReactNode } from "react";
import { StatusDot, Status } from "./primitives";

export type TableColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
  width?: number | string;
};

export type TableRow = {
  cells: Record<string, ReactNode>;
  status?: Status;   // if "bad" or "watch", subtle lateral tint
  indent?: number;   // nested rows (walkdown drilldown)
  bold?: boolean;
};

export function PremiumTable({
  columns,
  rows,
}: {
  columns: TableColumn[];
  rows: TableRow[];
}) {
  return (
    <table className="gos-table" style={{ width: "100%" }}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              style={{
                textAlign: col.align ?? "left",
                width: col.width,
              }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <PremiumRow key={i} row={row} columns={columns} />
        ))}
      </tbody>
    </table>
  );
}

function PremiumRow({ row, columns }: { row: TableRow; columns: TableColumn[] }) {
  const tint =
    row.status === "bad"
      ? "linear-gradient(90deg, rgba(255, 107, 107, 0.05), transparent 60%)"
      : row.status === "watch"
      ? "linear-gradient(90deg, rgba(245, 183, 78, 0.05), transparent 60%)"
      : undefined;

  return (
    <tr style={{ background: tint }}>
      {columns.map((col, i) => {
        const content = row.cells[col.key];
        const isFirst = i === 0;
        return (
          <td
            key={col.key}
            style={{
              textAlign: col.align ?? "left",
              paddingLeft: isFirst ? 14 + (row.indent ?? 0) * 20 : 14,
              fontWeight: row.bold ? 600 : undefined,
              color: row.bold ? "#eef2fa" : undefined,
            }}
          >
            {content}
          </td>
        );
      })}
    </tr>
  );
}

/* Reusable cell helpers ---------------------------------------------------- */

export function CellNumber({ value, color }: { value: string; color?: string }) {
  return (
    <span className="font-data" style={{ fontSize: 14, color: color ?? "#eef2fa" }}>
      {value}
    </span>
  );
}

export function CellMuted({ value }: { value: string }) {
  return (
    <span className="font-data" style={{ fontSize: 14, color: "#5f6b82" }}>
      {value}
    </span>
  );
}

export function CellStatus({ status, delta }: { status: Status; delta: string }) {
  return <StatusDot status={status} label={delta} />;
}
