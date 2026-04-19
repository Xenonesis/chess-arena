import Link from "next/link";
import { LeaderboardClient } from "@/components/leaderboard-client";

export default function LeaderboardPage() {
  return (
    <>
      <style>{`
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          border-radius: 6px;
          border: 1px solid var(--border-strong);
          color: var(--text-secondary);
          font-size: 13.5px;
          font-weight: 500;
          text-decoration: none;
          white-space: nowrap;
          transition: border-color 0.15s, color 0.15s;
          align-self: flex-start;
          margin-top: 28px;
        }
        .back-link:hover {
          border-color: rgba(255,255,255,0.28);
          color: var(--text-primary);
        }
      `}</style>

      <main
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "48px 24px 80px",
          width: "100%",
        }}
      >
        {/* Page header */}
        <header
          className="animate-enter"
          style={{
            marginBottom: 40,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.13em",
                textTransform: "uppercase",
                color: "var(--accent)",
                marginBottom: 10,
              }}
            >
              Performance Rankings
            </p>
            <h1
              style={{
                fontFamily: "var(--font-playfair), Georgia, serif",
                fontSize: "clamp(26px, 3.5vw, 38px)",
                fontWeight: 600,
                color: "var(--text-primary)",
                letterSpacing: "-0.02em",
                marginBottom: 10,
              }}
            >
              Leaderboard
            </h1>
            <p
              style={{
                fontSize: 14.5,
                color: "var(--text-secondary)",
                maxWidth: 540,
              }}
            >
              Rankings based on points with confidence-adjusted performance scores
              to prevent low-sample volatility.
            </p>
          </div>

          <Link href="/game" className="back-link">
            ← Back to Simulation
          </Link>
        </header>

        <div className="animate-enter-delay-1">
          <LeaderboardClient />
        </div>
      </main>
    </>
  );
}
