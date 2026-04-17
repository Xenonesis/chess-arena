import type { GameResult } from "@/lib/db/schema";

export function getPointsDelta(side: "white" | "black", result: GameResult) {
  if (result === "draw") {
    return 0.5;
  }

  if (result === "aborted") {
    return 0;
  }

  if (result === "white_win") {
    return side === "white" ? 1 : 0;
  }

  return side === "black" ? 1 : 0;
}

export function getConfidenceScore(points: number, gamesPlayed: number, prior = 10) {
  return (points + prior * 0.5) / (gamesPlayed + prior);
}
