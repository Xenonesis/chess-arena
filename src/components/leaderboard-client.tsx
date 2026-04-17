"use client";

import useSWR from "swr";

type LeaderboardRow = {
  rank: number;
  modelId: string;
  slug: string;
  name: string;
  provider: string;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  points: number;
  winRate: number;
  performance: number;
  provisional: boolean;
};

type LeaderboardPayload = {
  updatedAt: string;
  items: LeaderboardRow[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
};

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to load leaderboard");
  return (await response.json()) as LeaderboardPayload;
};

/* Performance bar visual */
function PerfBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          flex: 1,
          height: 4,
          background: "rgba(255,255,255,0.07)",
          borderRadius: 2,
          overflow: "hidden",
          minWidth: 60,
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--accent)",
            borderRadius: 2,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--accent)",
          fontVariantNumeric: "tabular-nums",
          minWidth: 48,
          textAlign: "right",
        }}
      >
        {value.toFixed(3)}
      </span>
    </div>
  );
}

/* Rank medal */
function RankCell({ rank }: { rank: number }) {
  const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {medals[rank] ? (
        <span style={{ fontSize: 15 }}>{medals[rank]}</span>
      ) : (
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          #{rank}
        </span>
      )}
    </span>
  );
}

/* Win/Loss/Draw summary pills */
function WldPills({
  wins,
  losses,
  draws,
}: {
  wins: number;
  losses: number;
  draws: number;
}) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[
        { label: "W", val: wins, color: "var(--accent)", bg: "var(--accent-dim)" },
        { label: "L", val: losses, color: "var(--danger)", bg: "var(--danger-dim)" },
        { label: "D", val: draws, color: "var(--warning)", bg: "rgba(251,191,36,0.1)" },
      ].map(({ label, val, color, bg }) => (
        <span
          key={label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: "2px 7px",
            borderRadius: 4,
            background: bg,
            fontSize: 11.5,
            fontWeight: 700,
            color,
          }}
        >
          {val}
          <span style={{ opacity: 0.55, fontWeight: 400, fontSize: 10 }}>{label}</span>
        </span>
      ))}
    </div>
  );
}

/* Skeleton loading row */
function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} style={{ padding: "12px 16px" }}>
          <div
            style={{
              height: 14,
              borderRadius: 4,
              background: "rgba(255,255,255,0.05)",
              width: i === 1 ? "80%" : "50%",
            }}
          />
        </td>
      ))}
    </tr>
  );
}

export function LeaderboardClient() {
  const { data, error, isLoading } = useSWR<LeaderboardPayload>(
    "/api/leaderboard?limit=50&offset=0",
    fetcher,
    {
      refreshInterval: 6000,
      revalidateOnFocus: true,
    },
  );

  if (isLoading) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Loading Rankings…
          </p>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid rgba(248,113,113,0.22)",
          borderRadius: 10,
          padding: "24px 20px",
          color: "var(--danger)",
          fontSize: 14,
        }}
      >
        Could not load leaderboard right now.
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "48px 24px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: 32,
            marginBottom: 12,
          }}
        >
          ♟
        </p>
        <p
          style={{
            fontSize: 15,
            color: "var(--text-secondary)",
            marginBottom: 6,
          }}
        >
          No completed games yet.
        </p>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
          Run a simulation to populate the rankings.
        </p>
      </div>
    );
  }

  const colStyle: React.CSSProperties = {
    padding: "10px 16px",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    whiteSpace: "nowrap",
    textAlign: "left",
    borderBottom: "1px solid var(--border)",
    background: "var(--surface)",
  };

  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Table header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontWeight: 600,
            fontSize: 17,
            color: "var(--text-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          Rankings
        </h2>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            fontWeight: 500,
            letterSpacing: "0.04em",
          }}
        >
          Updated {new Date(data.updatedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            minWidth: 720,
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th style={{ ...colStyle, width: 56 }}>Rank</th>
              <th style={colStyle}>Model</th>
              <th style={colStyle}>W / L / D</th>
              <th style={{ ...colStyle, width: 72 }}>Games</th>
              <th style={{ ...colStyle, width: 80 }}>Points</th>
              <th style={{ ...colStyle, width: 80 }}>Win %</th>
              <th style={{ ...colStyle, minWidth: 160 }}>Performance</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row, index) => (
              <tr
                key={row.modelId}
                style={{
                  borderBottom: "1px solid var(--border)",
                  transition: "background 0.12s",
                  background: index % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background =
                    "rgba(255,255,255,0.035)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background =
                    index % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)";
                }}
              >
                <td style={{ padding: "14px 16px" }}>
                  <RankCell rank={row.rank} />
                </td>

                <td style={{ padding: "14px 16px" }}>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {row.name}
                      </span>
                      {row.provisional && (
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 600,
                            letterSpacing: "0.07em",
                            textTransform: "uppercase",
                            color: "var(--warning)",
                            background: "rgba(251,191,36,0.08)",
                            borderRadius: 3,
                            padding: "2px 5px",
                            border: "1px solid rgba(251,191,36,0.18)",
                          }}
                        >
                          Provisional
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                      }}
                    >
                      {row.provider}
                    </span>
                  </div>
                </td>

                <td style={{ padding: "14px 16px" }}>
                  <WldPills
                    wins={row.wins}
                    losses={row.losses}
                    draws={row.draws}
                  />
                </td>

                <td
                  style={{
                    padding: "14px 16px",
                    fontSize: 13.5,
                    color: "var(--text-secondary)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {row.totalGames}
                </td>

                <td
                  style={{
                    padding: "14px 16px",
                    fontSize: 13.5,
                    color: "var(--text-primary)",
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                  }}
                >
                  {row.points.toFixed(1)}
                </td>

                <td
                  style={{
                    padding: "14px 16px",
                    fontSize: 13.5,
                    color: "var(--text-secondary)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {(row.winRate * 100).toFixed(1)}%
                </td>

                <td style={{ padding: "14px 16px" }}>
                  <PerfBar value={row.performance} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 11.5,
            color: "var(--text-muted)",
          }}
        >
          {data.pagination.total} model{data.pagination.total !== 1 ? "s" : ""} ranked
          · Refreshes every 6 seconds
        </span>
      </div>
    </section>
  );
}
