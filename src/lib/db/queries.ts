import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  DEFAULT_MODEL_CATALOG,
  type ModelCatalogEntry,
} from "@/lib/ai/model-catalog";
import { games, models, moves, type GameResult } from "@/lib/db/schema";
import { getConfidenceScore, getPointsDelta } from "@/lib/ranking/points";

function ensureDatabaseConfigured() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes("user:password@host/dbname")) {
    throw new Error(
      "DATABASE_URL is not configured. Update .env.local with a real Neon/Postgres URL, then run npm run db:migrate.",
    );
  }
}

export async function seedDefaultModels() {
  ensureDatabaseConfigured();

  for (const entry of DEFAULT_MODEL_CATALOG) {
    try {
      await db
        .insert(models)
        .values({
          id: crypto.randomUUID(),
          slug: entry.slug,
          name: entry.name,
          provider: entry.provider,
          openrouterModel: entry.openrouterModel,
        })
        .onConflictDoNothing();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to seed model catalog. Ensure migrations ran (npm run db:migrate) and DATABASE_URL points to that DB. Cause: ${reason}`,
      );
    }
  }
}

export async function getActiveModels() {
  return db
    .select({
      id: models.id,
      slug: models.slug,
      name: models.name,
      provider: models.provider,
      openrouterModel: models.openrouterModel,
    })
    .from(models)
    .where(eq(models.isActive, true))
    .orderBy(asc(models.name));
}

export async function getModelBySlug(slug: string) {
  const [row] = await db.select().from(models).where(eq(models.slug, slug)).limit(1);
  return row ?? null;
}

export async function upsertModelCatalogEntry(entry: ModelCatalogEntry) {
  ensureDatabaseConfigured();

  await db
    .insert(models)
    .values({
      id: crypto.randomUUID(),
      slug: entry.slug,
      name: entry.name,
      provider: entry.provider,
      openrouterModel: entry.openrouterModel,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: models.openrouterModel,
      set: {
        slug: entry.slug,
        name: entry.name,
        provider: entry.provider,
        isActive: true,
        updatedAt: new Date(),
      },
    });

  const [row] = await db
    .select()
    .from(models)
    .where(eq(models.openrouterModel, entry.openrouterModel))
    .limit(1);

  return row ?? null;
}

export async function getModelsByIds(ids: string[]) {
  if (!ids.length) {
    return [];
  }

  return db.select().from(models).where(inArray(models.id, ids));
}

export async function getGameById(gameId: string) {
  const [row] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  return row ?? null;
}

export async function getMovesByGameId(gameId: string) {
  return db
    .select({
      ply: moves.ply,
      moveUci: moves.moveUci,
      moveSan: moves.moveSan,
      source: moves.source,
      playedByModelId: moves.playedByModelId,
      createdAt: moves.createdAt,
    })
    .from(moves)
    .where(eq(moves.gameId, gameId))
    .orderBy(asc(moves.ply));
}

export async function createGame(input: {
  modelWhiteId: string;
  modelBlackId: string;
  currentFen: string;
  turn: "w" | "b";
  maxPlies: number;
}) {
  ensureDatabaseConfigured();

  const [row] = await db
    .insert(games)
    .values({
      id: crypto.randomUUID(),
      modelWhiteId: input.modelWhiteId,
      modelBlackId: input.modelBlackId,
      currentFen: input.currentFen,
      turn: input.turn,
      maxPlies: input.maxPlies,
      status: "running",
    })
    .returning();

  return row;
}

export async function updateModelStatsForResult(input: {
  whiteModelId: string;
  blackModelId: string;
  result: GameResult;
}) {
  if (input.result === "aborted") {
    return;
  }

  const whiteDelta = getPointsDelta("white", input.result);
  const blackDelta = getPointsDelta("black", input.result);

  await db
    .update(models)
    .set({
      wins:
        input.result === "white_win"
          ? sql`${models.wins} + 1`
          : sql`${models.wins}`,
      losses:
        input.result === "black_win"
          ? sql`${models.losses} + 1`
          : sql`${models.losses}`,
      draws:
        input.result === "draw"
          ? sql`${models.draws} + 1`
          : sql`${models.draws}`,
      totalGames: sql`${models.totalGames} + 1`,
      score: sql`${models.score} + ${whiteDelta}`,
      updatedAt: new Date(),
    })
    .where(eq(models.id, input.whiteModelId));

  await db
    .update(models)
    .set({
      wins:
        input.result === "black_win"
          ? sql`${models.wins} + 1`
          : sql`${models.wins}`,
      losses:
        input.result === "white_win"
          ? sql`${models.losses} + 1`
          : sql`${models.losses}`,
      draws:
        input.result === "draw"
          ? sql`${models.draws} + 1`
          : sql`${models.draws}`,
      totalGames: sql`${models.totalGames} + 1`,
      score: sql`${models.score} + ${blackDelta}`,
      updatedAt: new Date(),
    })
    .where(eq(models.id, input.blackModelId));
}

export async function getLeaderboardRows() {
  const rows = await db
    .select({
      id: models.id,
      slug: models.slug,
      name: models.name,
      provider: models.provider,
      wins: models.wins,
      losses: models.losses,
      draws: models.draws,
      totalGames: models.totalGames,
      score: models.score,
    })
    .from(models)
    .where(eq(models.isActive, true))
    .orderBy(desc(models.score), desc(models.totalGames), desc(models.wins));

  return rows.map((row) => {
    const totalGames = row.totalGames;
    const rawScore = Number(row.score);

    return {
      ...row,
      score: rawScore,
      winRate: totalGames > 0 ? row.wins / totalGames : 0,
      confidenceScore: getConfidenceScore(rawScore, totalGames),
    };
  });
}

export async function markGameCompleted(input: {
  gameId: string;
  expectedVersion: number;
  result: GameResult;
  winnerModelId: string | null;
  terminationReason: string;
  currentFen: string;
  turn: "w" | "b";
  ply: number;
}) {
  const [row] = await db
    .update(games)
    .set({
      status: input.result === "aborted" ? "aborted" : "completed",
      result: input.result,
      winnerModelId: input.winnerModelId,
      terminationReason: input.terminationReason,
      currentFen: input.currentFen,
      turn: input.turn,
      ply: input.ply,
      version: sql`${games.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(games.id, input.gameId),
        eq(games.version, input.expectedVersion),
        inArray(games.status, ["running", "paused"]),
      ),
    )
    .returning();

  return row ?? null;
}
