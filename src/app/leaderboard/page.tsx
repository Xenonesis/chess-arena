import Link from "next/link";
import { LeaderboardClient } from "@/components/leaderboard-client";

export default function LeaderboardPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <header className="mb-8 grid gap-3">
        <p className="text-xs uppercase tracking-[0.22em] text-amber-300/90">
          Performance Rankings
        </p>
        <h1 className="text-3xl font-semibold text-stone-100 md:text-4xl">
          Leaderboard
        </h1>
        <p className="max-w-3xl text-stone-300">
          Ranking is based on points and a confidence-adjusted performance score to
          prevent low-sample volatility.
        </p>
        <div>
          <Link
            href="/game"
            className="rounded-lg border border-stone-500 px-4 py-2 text-sm font-semibold text-stone-200 transition hover:border-stone-300"
          >
            Back to Simulation
          </Link>
        </div>
      </header>

      <LeaderboardClient />
    </main>
  );
}
