import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  applyUciMove,
  extractLegalUciMove,
  extractUciMove,
  getLegalMoves,
} from "@/lib/chess/move-utils";

describe("move utils", () => {
  it("extracts uci move from noisy text", () => {
    const move = extractUciMove("Best move: e2e4. Thanks");
    expect(move).toBe("e2e4");
  });

  it("extracts legal move when model returns SAN", () => {
    const legalMoves = getLegalMoves(new Chess().fen());
    const move = extractLegalUciMove("I choose Nf3", legalMoves);
    expect(move).toBe("g1f3");
  });

  it("extracts legal move when model returns castling SAN", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    const legalMoves = getLegalMoves(fen);
    const move = extractLegalUciMove("Best move is O-O.", legalMoves);
    expect(move).toBe("e1g1");
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
