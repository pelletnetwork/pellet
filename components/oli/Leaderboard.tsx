import Link from "next/link";

export type LeaderboardCol<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  width?: string;
};

export function Leaderboard<T extends { id: string }>({
  title,
  rows,
  cols,
  hrefFor,
}: {
  title: string;
  rows: T[];
  cols: LeaderboardCol<T>[];
  hrefFor?: (row: T) => string;
}) {
  return (
    <div className="oli-leaderboard">
      <div className="oli-leaderboard-title">
        <span>{title}</span>
        <span style={{ color: "var(--color-text-quaternary)", fontSize: 11 }}>
          {rows.length} rows
        </span>
      </div>

      <div className="oli-leaderboard-table">
        <div
          className="oli-leaderboard-row oli-leaderboard-header"
          style={{ gridTemplateColumns: cols.map((c) => c.width ?? "1fr").join(" ") }}
        >
          {cols.map((c) => (
            <span key={c.key} style={{ textAlign: c.align ?? "left" }}>
              {c.header}
            </span>
          ))}
        </div>

        {rows.map((row) => {
          const inner = (
            <div
              className="oli-leaderboard-row"
              style={{ gridTemplateColumns: cols.map((c) => c.width ?? "1fr").join(" ") }}
            >
              {cols.map((c) => (
                <span
                  key={c.key}
                  style={{ textAlign: c.align ?? "left" }}
                >
                  {c.cell(row)}
                </span>
              ))}
            </div>
          );
          return hrefFor ? (
            <Link key={row.id} href={hrefFor(row)} className="oli-leaderboard-link">
              {inner}
            </Link>
          ) : (
            <div key={row.id}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
