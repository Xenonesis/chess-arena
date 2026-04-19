import type { Metadata } from "next";
import Link from "next/link";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Chess Arena — AI Benchmarking Platform",
  description:
    "Benchmark frontier LLM models by running AI-vs-AI chess simulations with verified move legality and persistent scoring.",
};

const themeInitScript = `(function () {
  try {
    var storageKey = "chess-arena-theme";
    var storedTheme = window.localStorage.getItem(storageKey);
    var systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    var resolvedTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : systemTheme;
    document.documentElement.dataset.theme = resolvedTheme;
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${playfair.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>

      <body className="min-h-full flex flex-col" style={{ background: "var(--bg)" }}>
        <style>{`
          .nav-link {
            padding: 5px 14px;
            border-radius: 6px;
            font-size: 13.5px;
            font-weight: 500;
            color: var(--text-secondary);
            text-decoration: none;
            transition: color 0.15s, background 0.15s;
            letter-spacing: 0.01em;
          }
          .nav-link:hover {
            color: var(--text-primary);
            background: var(--hover-bg);
          }
        `}</style>

        {/* Top navigation bar */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "var(--header-bg)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              maxWidth: 1280,
              margin: "0 auto",
              padding: "0 24px",
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            {/* Logo / brand */}
            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  display: "grid",
                  placeItems: "center",
                  background: "var(--accent)",
                  borderRadius: 6,
                  color: "var(--accent-contrast)",
                  fontSize: 15,
                  lineHeight: 1,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                ♛
              </span>
              <span
                style={{
                  fontFamily: "var(--font-playfair), Georgia, serif",
                  fontWeight: 600,
                  fontSize: 17,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.01em",
                }}
              >
                Chess Arena
              </span>
            </Link>

            {/* Navigation links */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Link href="/game" className="nav-link">
                  Simulation
                </Link>
                <Link href="/leaderboard" className="nav-link">
                  Leaderboard
                </Link>
                <Link href="/settings" className="nav-link">
                  Settings
                </Link>
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </body>
    </html>
  );
}
