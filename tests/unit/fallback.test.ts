import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { pickDeterministicFallbackMove } from "@/lib/chess/fallback";
import { getLegalMoves } from "@/lib/chess/move-utils";

describe("deterministic fallback", () => {
  it("returns same move for same seed", () => {
    const fen = new Chess().fen();
    const legalMoves = getLegalMoves(fen);

    const first = pickDeterministicFallbackMove({
      gameId: "f31d13db-7a53-4f14-b8fd-00bb80b3dad2",
      ply: 1,
      modelId: "847ccddb-3a2c-4ba5-8d09-a35d8c7c91d5",
      fen,
      legalMoves,
    });

    const second = pickDeterministicFallbackMove({
      gameId: "f31d13db-7a53-4f14-b8fd-00bb80b3dad2",
      ply: 1,
      modelId: "847ccddb-3a2c-4ba5-8d09-a35d8c7c91d5",
      fen,
      legalMoves,
    });

    expect(first?.uci).toBe(second?.uci);
  });
});
