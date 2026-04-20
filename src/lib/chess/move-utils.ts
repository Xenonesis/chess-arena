import { Chess, type Move } from "chess.js";
import type { GameResult } from "@/lib/db/schema";

export type LegalMove = {
  uci: string;
  san: string;
  move: Move;
};

const UCI_PATTERN = /\b([a-h][1-8][a-h][1-8][qrbn]?)\b/i;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSan(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/[+#?!]/g, "");
}

function findUciFromSan(rawText: string, legalMoves: LegalMove[]) {
  const normalizedRaw = normalizeSan(rawText);

  for (const legalMove of legalMoves) {
    const normalizedSan = normalizeSan(legalMove.san);
    if (!normalizedSan) continue;

    const variants = new Set<string>([
      normalizedSan,
      normalizedSan.replace("x", ""),
    ]);

    for (const variant of variants) {
      if (!variant) continue;

      const pattern = new RegExp(
        `(^|[^a-z0-9])${escapeRegExp(variant)}($|[^a-z0-9])`,
        "i",
      );

      if (pattern.test(normalizedRaw)) {
        return legalMove.uci;
      }
    }
  }

  return null;
}

export function extractUciMove(rawText: string) {
  const match = rawText.match(UCI_PATTERN);
  return match ? match[1].toLowerCase() : null;
}

export function extractLegalUciMove(rawText: string, legalMoves: LegalMove[]) {
  const extractedUci = extractUciMove(rawText);
  if (extractedUci && legalMoves.some((entry) => entry.uci === extractedUci)) {
    return extractedUci;
  }

  return findUciFromSan(rawText, legalMoves);
}

export function toUci(move: Move) {
  return `${move.from}${move.to}${move.promotion ?? ""}`.toLowerCase();
}

export function getLegalMoves(fen: string): LegalMove[] {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true }) as Move[];
  return moves.map((move) => ({
    uci: toUci(move),
    san: move.san,
    move,
  }));
}

export function applyUciMove(fen: string, uci: string) {
  const chess = new Chess(fen);
  const legal = getLegalMoves(fen);
  const picked = legal.find((entry) => entry.uci === uci.toLowerCase());

  if (!picked) {
    return null;
  }

  chess.move(picked.move);

  return {
    moveUci: picked.uci,
    moveSan: picked.san,
    fenAfter: chess.fen(),
    turnAfter: chess.turn() as "w" | "b",
    gameOver: chess.isGameOver(),
    check: chess.inCheck(),
    outcome: getOutcomeFromState(chess),
  };
}

export function getOutcomeFromState(chess: Chess): {
  result: GameResult;
  winnerSide: "w" | "b" | null;
  reason: string;
} | null {
  if (!chess.isGameOver()) {
    return null;
  }

  if (chess.isCheckmate()) {
    const loser = chess.turn();
    return {
      result: loser === "w" ? "black_win" : "white_win",
      winnerSide: loser === "w" ? "b" : "w",
      reason: "checkmate",
    };
  }

  if (chess.isStalemate()) {
    return {
      result: "draw",
      winnerSide: null,
      reason: "stalemate",
    };
  }

  if (chess.isThreefoldRepetition()) {
    return {
      result: "draw",
      winnerSide: null,
      reason: "threefold_repetition",
    };
  }

  if (chess.isInsufficientMaterial()) {
    return {
      result: "draw",
      winnerSide: null,
      reason: "insufficient_material",
    };
  }

  if (chess.isDraw()) {
    return {
      result: "draw",
      winnerSide: null,
      reason: "draw",
    };
  }

  return {
    result: "draw",
    winnerSide: null,
    reason: "unknown_terminal_state",
  };
}
