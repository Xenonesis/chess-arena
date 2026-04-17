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
  if (!response.ok) {
    throw new Error("Failed to load leaderboard");
  }
  return (await response.json()) as LeaderboardPayload;
};

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
      <div className="rounded-2xl border border-stone-700/40 bg-stone-950/70 p-6 text-stone-200">
        Loading leaderboard...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-400/40 bg-rose-900/20 p-6 text-rose-200">
        Could not load leaderboard right now.
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-700/40 bg-stone-950/70 p-6 text-stone-300">
        No completed games yet. Run real simulations to populate the leaderboard.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-stone-700/40 bg-stone-950/70 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-stone-100">Leaderboard</h2>
        <span className="text-xs uppercase tracking-[0.18em] text-stone-400">
          Updated {new Date(data.updatedAt).toLocaleTimeString()}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-700 text-stone-300">
              <th className="px-2 py-2">Rank</th>
              <th className="px-2 py-2">Model</th>
              <th className="px-2 py-2">Provider</th>
              <th className="px-2 py-2">W</th>
              <th className="px-2 py-2">L</th>
              <th className="px-2 py-2">D</th>
              <th className="px-2 py-2">Games</th>
              <th className="px-2 py-2">Points</th>
              <th className="px-2 py-2">Win %</th>
              <th className="px-2 py-2">Performance</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr
                key={row.modelId}
                className="border-b border-stone-800/70 text-stone-200 transition hover:bg-stone-900/70"
              >
                <td className="px-2 py-2 font-semibold text-amber-300">#{row.rank}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <span>{row.name}</span>
                    {row.provisional ? (
                      <span className="rounded-full border border-stone-600 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-stone-400">
                        Provisional
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-2 py-2 text-stone-400">{row.provider}</td>
                <td className="px-2 py-2">{row.wins}</td>
                <td className="px-2 py-2">{row.losses}</td>
                <td className="px-2 py-2">{row.draws}</td>
                <td className="px-2 py-2">{row.totalGames}</td>
                <td className="px-2 py-2">{row.points.toFixed(2)}</td>
                <td className="px-2 py-2">{(row.winRate * 100).toFixed(1)}%</td>
                <td className="px-2 py-2 font-semibold text-emerald-300">
                  {row.performance.toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
