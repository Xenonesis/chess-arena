import { NextResponse } from "next/server";
import { listOpenRouterCatalog } from "@/lib/ai/openrouter-catalog";
import { getActiveModels, seedDefaultModels } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET() {
  try {
    await seedDefaultModels();

    const [databaseModels, openRouterModels] = await Promise.all([
      getActiveModels(),
      listOpenRouterCatalog().catch(() => []),
    ]);

    const mergedByOpenRouterModel = new Map(
      databaseModels.map((entry) => [entry.openrouterModel, entry]),
    );

    for (const entry of openRouterModels) {
      if (mergedByOpenRouterModel.has(entry.openrouterModel)) {
        continue;
      }

      mergedByOpenRouterModel.set(entry.openrouterModel, {
        id: entry.openrouterModel,
        slug: entry.slug,
        name: entry.name,
        provider: entry.provider,
        openrouterModel: entry.openrouterModel,
      });
    }

    const models = Array.from(mergedByOpenRouterModel.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    return NextResponse.json({
      items: models,
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
