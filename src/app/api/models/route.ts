import { NextResponse } from "next/server";
import { listOpenRouterCatalog } from "@/lib/ai/openrouter-catalog";

export const runtime = "nodejs";

export async function GET() {
  try {
    const models = await listOpenRouterCatalog();

    return NextResponse.json({
      items: models.map((entry) => ({
        id: entry.openrouterModel,
        slug: entry.slug,
        name: entry.name,
        provider: entry.provider,
        openrouterModel: entry.openrouterModel,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch model catalog",
        details: message,
      },
      { status: 500 },
    );
  }
}
