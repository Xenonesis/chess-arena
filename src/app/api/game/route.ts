import { Chess } from "chess.js";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getOpenRouterModelBySlug } from "@/lib/ai/openrouter-catalog";
import { createGameSchema } from "@/lib/api/contracts";
import { db } from "@/lib/db/client";
import { games } from "@/lib/db/schema";
import {
  createGame,
  getGameById,
  getModelBySlug,
  getModelsByIds,
  getMovesByGameId,
  seedDefaultModels,
  upsertModelCatalogEntry,
} from "@/lib/db/queries";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await seedDefaultModels();

    const rawPayload = await request.json();
    const payload = createGameSchema.safeParse(rawPayload);

    if (!payload.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          issues: payload.error.issues,
        },
        { status: 400 },
      );
    }

    if (payload.data.whiteModelSlug === payload.data.blackModelSlug) {
      return NextResponse.json(
        {
          error: "Select two different models",
        },
        { status: 400 },
      );
    }

    const resolveModel = async (slug: string) => {
      const existing = await getModelBySlug(slug);
      if (existing) {
        return existing;
      }

      const openRouterEntry = await getOpenRouterModelBySlug(slug);
      if (!openRouterEntry) {
        return null;
      }

      return upsertModelCatalogEntry(openRouterEntry);
    };

    const [whiteModel, blackModel] = await Promise.all([
      resolveModel(payload.data.whiteModelSlug),
      resolveModel(payload.data.blackModelSlug),
    ]);

    if (!whiteModel || !blackModel) {
      return NextResponse.json(
        {
          error: "Model not found in catalog",
        },
        { status: 404 },
      );
    }

    const chess = new Chess();
    if (payload.data.initialFen) {
      chess.load(payload.data.initialFen);
    }

    const game = await createGame({
      modelWhiteId: whiteModel.id,
      modelBlackId: blackModel.id,
      currentFen: chess.fen(),
      turn: chess.turn() as "w" | "b",
      maxPlies: payload.data.maxPlies,
    });

    return NextResponse.json(
      {
        gameId: game.id,
        status: game.status,
        currentFen: game.currentFen,
        turn: game.turn,
        ply: game.ply,
        version: game.version,
        maxPlies: game.maxPlies,
        whiteModel: {
          id: whiteModel.id,
          name: whiteModel.name,
          slug: whiteModel.slug,
        },
        blackModel: {
          id: blackModel.id,
          name: blackModel.name,
          slug: blackModel.slug,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to create game",
        details: message,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const gameId = request.nextUrl.searchParams.get("gameId");

    if (!gameId) {
      return NextResponse.json({ error: "gameId is required" }, { status: 400 });
    }

    const game = await getGameById(gameId);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const modelRows = await getModelsByIds([game.modelWhiteId, game.modelBlackId]);
    const modelById = new Map(modelRows.map((entry) => [entry.id, entry]));

    const history = await getMovesByGameId(game.id);

    return NextResponse.json({
      gameId: game.id,
      status: game.status,
      result: game.result,
      winnerModelId: game.winnerModelId,
      terminationReason: game.terminationReason,
      currentFen: game.currentFen,
      turn: game.turn,
      ply: game.ply,
      version: game.version,
      maxPlies: game.maxPlies,
      whiteModel: modelById.get(game.modelWhiteId) ?? null,
      blackModel: modelById.get(game.modelBlackId) ?? null,
      moves: history,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to load game",
        details: message,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const gameId = request.nextUrl.searchParams.get("gameId");

    if (!gameId) {
      return NextResponse.json({ error: "gameId is required" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(games)
      .where(and(eq(games.id, gameId), eq(games.status, "running")))
      .returning({ id: games.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Active game not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, gameId: deleted.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to delete game",
        details: message,
      },
      { status: 500 },
    );
  }
}
