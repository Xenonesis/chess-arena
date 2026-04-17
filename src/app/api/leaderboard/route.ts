import { NextRequest, NextResponse } from "next/server";
import { leaderboardQuerySchema } from "@/lib/api/contracts";
import { getLeaderboardRows } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const payload = leaderboardQuerySchema.safeParse({
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      offset: request.nextUrl.searchParams.get("offset") ?? undefined,
    });

    if (!payload.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          issues: payload.error.issues,
        },
        { status: 400 },
      );
    }

    const allRows = await getLeaderboardRows();
    const sorted = [...allRows].sort((a, b) => {
      if (b.confidenceScore !== a.confidenceScore) {
        return b.confidenceScore - a.confidenceScore;
      }
      if (b.totalGames !== a.totalGames) {
        return b.totalGames - a.totalGames;
      }
      return b.wins - a.wins;
    });

    const start = payload.data.offset;
    const end = start + payload.data.limit;
    const page = sorted.slice(start, end).map((entry, index) => ({
      rank: start + index + 1,
      modelId: entry.id,
      slug: entry.slug,
      name: entry.name,
      provider: entry.provider,
      wins: entry.wins,
      losses: entry.losses,
      draws: entry.draws,
      totalGames: entry.totalGames,
      points: entry.score,
      winRate: entry.winRate,
      performance: entry.confidenceScore,
      provisional: entry.totalGames < 10,
    }));

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      items: page,
      pagination: {
        total: sorted.length,
        limit: payload.data.limit,
        offset: payload.data.offset,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to load leaderboard",
        details: message,
      },
      { status: 500 },
    );
  }
}
