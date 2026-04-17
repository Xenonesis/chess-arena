import { and, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { resultSchema } from "@/lib/api/contracts";
import { db } from "@/lib/db/client";
import { getGameById, updateModelStatsForResult } from "@/lib/db/queries";
import { games, type GameResult } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const rawPayload = await request.json();
    const payload = resultSchema.safeParse(rawPayload);

    if (!payload.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          issues: payload.error.issues,
        },
        { status: 400 },
      );
    }

    const game = await getGameById(payload.data.gameId);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (game.status === "completed" || game.status === "aborted") {
      return NextResponse.json({
        gameId: game.id,
        status: game.status,
        result: game.result,
        winnerModelId: game.winnerModelId,
      });
    }

    const winnerModelId =
      payload.data.result === "white_win"
        ? game.modelWhiteId
        : payload.data.result === "black_win"
          ? game.modelBlackId
          : null;

    const [updated] = await db
      .update(games)
      .set({
        status: payload.data.result === "aborted" ? "aborted" : "completed",
        result: payload.data.result,
        winnerModelId,
        terminationReason: payload.data.terminationReason,
        version: sql`${games.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(games.id, game.id), eq(games.version, game.version)))
      .returning();

    if (!updated) {
      return NextResponse.json(
        {
          error: "Game changed before result write. Retry request.",
        },
        { status: 409 },
      );
    }

    await updateModelStatsForResult({
      whiteModelId: game.modelWhiteId,
      blackModelId: game.modelBlackId,
      result: payload.data.result as GameResult,
    });

    return NextResponse.json({
      gameId: updated.id,
      status: updated.status,
      result: updated.result,
      winnerModelId: updated.winnerModelId,
      terminationReason: updated.terminationReason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to finalize game",
        details: message,
      },
      { status: 500 },
    );
  }
}
