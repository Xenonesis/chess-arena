import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { applyUciMove, extractUciMove, getLegalMoves } from "@/lib/chess/move-utils";

describe("move utils", () => {
  it("extracts uci move from noisy text", () => {
    const move = extractUciMove("Best move: e2e4. Thanks");
    expect(move).toBe("e2e4");
  });

  it("applies legal uci move and returns next fen", () => {
    const chess = new Chess();
    const currentFen = chess.fen();

    const result = applyUciMove(currentFen, "e2e4");

    expect(result).not.toBeNull();
    expect(result?.moveUci).toBe("e2e4");
    expect(result?.fenAfter).not.toBe(currentFen);
  });

  it("lists legal moves with uci formatting", () => {
    const legalMoves = getLegalMoves(new Chess().fen());
    expect(legalMoves.length).toBeGreaterThan(0);
    expect(legalMoves[0]).toHaveProperty("uci");
    expect(legalMoves[0]).toHaveProperty("san");
  });
});
