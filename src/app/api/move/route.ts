import { and, eq, sql } from "drizzle-orm";
import { Chess } from "chess.js";
import { NextRequest, NextResponse } from "next/server";
import { requestMove } from "@/lib/ai/dispatcher";
import {
  mergeProviderConfigForSide,
  type ProviderConfig,
} from "@/lib/ai/provider-config";
import { moveStepSchema } from "@/lib/api/contracts";
import {
  applyUciMove,
  extractUciMove,
  getLegalMoves,
  getOutcomeFromState,
} from "@/lib/chess/move-utils";
import { db } from "@/lib/db/client";
import {
  getGameById,
  getModelsByIds,
  markGameCompleted,
  updateModelStatsForResult,
} from "@/lib/db/queries";
import { games, moves, type GameResult, type MoveSource } from "@/lib/db/schema";

export const runtime = "nodejs";

function parseProviderConfig(request: NextRequest): ProviderConfig {
  try {
    const raw = request.headers.get("x-provider-config");
    if (!raw) return {};
    return JSON.parse(raw) as ProviderConfig;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawPayload = await request.json();
    const payload = moveStepSchema.safeParse(rawPayload);

    if (!payload.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          issues: payload.error.issues,
        },
        { status: 400 },
      );
    }

    const providerConfig = parseProviderConfig(request);

    const game = await getGameById(payload.data.gameId);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status !== "running") {
      return NextResponse.json(
        { error: "Game is not running", status: game.status },
        { status: 409 },
      );
    }

    if (
      payload.data.expectedVersion !== undefined &&
      payload.data.expectedVersion !== game.version
    ) {
      return NextResponse.json(
        {
          error: "Version mismatch",
          expectedVersion: game.version,
        },
        { status: 409 },
      );
    }

    const legalMoves = getLegalMoves(game.currentFen);

    if (legalMoves.length === 0) {
      return NextResponse.json(
        { error: "No legal moves available" },
        { status: 409 },
      );
    }

    if (game.ply >= game.maxPlies) {
      const completed = await markGameCompleted({
        gameId: game.id,
        expectedVersion: game.version,
        result: "draw",
        winnerModelId: null,
        terminationReason: "max_plies",
        currentFen: game.currentFen,
        turn: game.turn as "w" | "b",
        ply: game.ply,
      });

      if (!completed) {
        return NextResponse.json(
          {
            error: "Game changed before completion",
          },
          { status: 409 },
        );
      }

      await updateModelStatsForResult({
        whiteModelId: game.modelWhiteId,
        blackModelId: game.modelBlackId,
        result: "draw",
      });

      return NextResponse.json({
        gameId: completed.id,
        state: {
          status: completed.status,
          version: completed.version,
          currentFen: completed.currentFen,
          turn: completed.turn,
          ply: completed.ply,
        },
        outcome: {
          result: completed.result,
          reason: completed.terminationReason,
        },
      });
    }

    const modelRows = await getModelsByIds([game.modelWhiteId, game.modelBlackId]);
    const modelById = new Map(modelRows.map((entry) => [entry.id, entry]));
    const whiteModel = modelById.get(game.modelWhiteId);
    const blackModel = modelById.get(game.modelBlackId);

    const modelForTurn = game.turn === "w" ? whiteModel : blackModel;
    const providerConfigForTurn = mergeProviderConfigForSide(
      providerConfig,
      game.turn === "w" ? "white" : "black",
    );
    if (!modelForTurn) {
      return NextResponse.json(
        { error: "Model record missing for current turn" },
        { status: 500 },
      );
    }

    const legalUci = legalMoves.map((entry) => entry.uci);

    let rawOutput = "";
    let selectedUci: string | null = null;
    let source: MoveSource = "model";
    let callFailureCode: string | null = null;
    let callFailureDetails: string | null = null;

    const startedAt = Date.now();

    try {
      rawOutput = await requestMove({
        fen: game.currentFen,
        modelName: modelForTurn.openrouterModel,
        strict: false,
        providerConfig: providerConfigForTurn,
      });
      selectedUci = extractUciMove(rawOutput);
    } catch (error) {
      callFailureCode = "ai_call_failed";
      callFailureDetails =
        error instanceof Error ? error.message : "Unknown error";
    }

    if (!selectedUci || !legalUci.includes(selectedUci)) {
      try {
        source = "retry";
        rawOutput = await requestMove({
          fen: game.currentFen,
          modelName: modelForTurn.openrouterModel,
          strict: true,
          legalMoves: legalUci,
          providerConfig: providerConfigForTurn,
        });
        selectedUci = extractUciMove(rawOutput);
        callFailureCode = null;
        callFailureDetails = null;
      } catch (error) {
        callFailureCode = "ai_retry_call_failed";
        callFailureDetails =
          error instanceof Error ? error.message : "Unknown error";
      }
    }

    if (callFailureCode) {
      return NextResponse.json(
        {
          error: "AI call failed",
          details: callFailureDetails
            ? `${callFailureCode}: ${callFailureDetails}`
            : callFailureCode,
        },
        { status: 502 },
      );
    }

    if (!selectedUci || !legalUci.includes(selectedUci)) {
      return NextResponse.json(
        {
          error: "Model returned an invalid move",
          details:
            "Model output could not be parsed as a legal UCI move after retry.",
          modelOutput: rawOutput.slice(0, 200),
        },
        { status: 422 },
      );
    }

    const moveResult = applyUciMove(game.currentFen, selectedUci);
    if (!moveResult) {
      return NextResponse.json(
        {
          error: "Selected move is not legal",
          selectedUci,
        },
        { status: 422 },
      );
    }

    const nextPly = game.ply + 1;
    const nextVersion = game.version + 1;

    const [updatedGame] = await db
      .update(games)
      .set({
        currentFen: moveResult.fenAfter,
        turn: moveResult.turnAfter,
        ply: nextPly,
        version: sql`${games.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(games.id, game.id),
          eq(games.version, game.version),
          eq(games.status, "running"),
        ),
      )
      .returning();

    if (!updatedGame) {
      return NextResponse.json(
        {
          error: "Concurrent update detected. Retry move call.",
        },
        { status: 409 },
      );
    }

    await db.insert(moves).values({
      gameId: game.id,
      ply: nextPly,
      playedByModelId: modelForTurn.id,
      moveUci: moveResult.moveUci,
      moveSan: moveResult.moveSan,
      fenBefore: game.currentFen,
      fenAfter: moveResult.fenAfter,
      source,
      modelRawOutput: rawOutput,
      latencyMs: Date.now() - startedAt,
    });

    let outcome = getOutcomeFromState(new Chess(moveResult.fenAfter));

    if (!outcome && nextPly >= game.maxPlies) {
      outcome = {
        result: "draw",
        winnerSide: null,
        reason: "max_plies",
      };
    }

    if (outcome) {
      const winnerModelId =
        outcome.winnerSide === "w"
          ? game.modelWhiteId
          : outcome.winnerSide === "b"
            ? game.modelBlackId
            : null;

      const [completedGame] = await db
        .update(games)
        .set({
          status: "completed",
          result: outcome.result as GameResult,
          winnerModelId,
          terminationReason: outcome.reason,
          version: sql`${games.version} + 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(games.id, game.id), eq(games.version, nextVersion)))
        .returning();

      if (completedGame) {
        await updateModelStatsForResult({
          whiteModelId: game.modelWhiteId,
          blackModelId: game.modelBlackId,
          result: outcome.result as GameResult,
        });
      }

      return NextResponse.json({
        gameId: game.id,
        move: {
          ply: nextPly,
          uci: moveResult.moveUci,
          san: moveResult.moveSan,
          source,
          playedByModelId: modelForTurn.id,
        },
        state: {
          status: completedGame?.status ?? "completed",
          version: completedGame?.version ?? nextVersion + 1,
          currentFen: moveResult.fenAfter,
          turn: moveResult.turnAfter,
          ply: nextPly,
        },
        outcome: {
          result: outcome.result,
          reason: outcome.reason,
          winnerModelId,
        },
      });
    }

    return NextResponse.json({
      gameId: game.id,
      move: {
        ply: nextPly,
        uci: moveResult.moveUci,
        san: moveResult.moveSan,
        source,
        playedByModelId: modelForTurn.id,
      },
      state: {
        status: "running",
        version: nextVersion,
        currentFen: moveResult.fenAfter,
        turn: moveResult.turnAfter,
        ply: nextPly,
      },
      outcome: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to process move",
        details: message,
      },
      { status: 500 },
    );
  }
}
