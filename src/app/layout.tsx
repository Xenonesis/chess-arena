import type { Metadata } from "next";
import Link from "next/link";
import { Cinzel, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Chess Simulation Platform",
  description:
    "Benchmark LLM models by running persistent AI-vs-AI chess simulations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-stone-950 text-stone-100">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,0.12),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(45,212,191,0.12),transparent_35%),linear-gradient(160deg,#090909,#121212_50%,#171717)]" />
        <div className="min-h-full flex flex-col">
          <header className="border-b border-stone-700/50 bg-stone-950/70 backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
              <Link href="/" className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-300">
                Chess Arena
              </Link>
              <nav className="flex items-center gap-3 text-sm text-stone-300">
                <Link className="rounded-lg px-3 py-1.5 transition hover:bg-stone-800" href="/game">
                  Simulation
                </Link>
                <Link className="rounded-lg px-3 py-1.5 transition hover:bg-stone-800" href="/leaderboard">
                  Leaderboard
                </Link>
              </nav>
            </div>
          </header>
          <div className="flex flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
