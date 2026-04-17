import type { LegalMove } from "@/lib/chess/move-utils";

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function pickDeterministicFallbackMove(input: {
  gameId: string;
  ply: number;
  modelId: string;
  fen: string;
  legalMoves: LegalMove[];
}) {
  const sorted = [...input.legalMoves].sort((a, b) => a.uci.localeCompare(b.uci));

  if (sorted.length === 0) {
    return null;
  }

  const seed = `${input.gameId}:${input.ply}:${input.modelId}:${input.fen}`;
  const offset = hashString(seed) % sorted.length;
  return sorted[offset];
}
