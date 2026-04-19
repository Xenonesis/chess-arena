import { NextRequest, NextResponse } from "next/server";
import { listOpenRouterCatalog } from "@/lib/ai/openrouter-catalog";
import { listGroqModels } from "@/lib/ai/groq";
import type { ProviderConfig } from "@/lib/ai/provider-config";

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

export async function GET(request: NextRequest) {
  try {
    const providerConfig = parseProviderConfig(request);
    const openrouterKeys = Array.from(
      new Set(
        [
          providerConfig.openrouterApiKey,
          providerConfig.white?.openrouterApiKey,
          providerConfig.black?.openrouterApiKey,
        ].filter((value): value is string => Boolean(value?.trim())),
      ),
    );

    const openrouterCatalogs =
      openrouterKeys.length > 0
        ? await Promise.all(openrouterKeys.map((key) => listOpenRouterCatalog(key)))
        : [await listOpenRouterCatalog(undefined)];

    const openrouterModels = Array.from(
      new Map(openrouterCatalogs.flat().map((entry) => [entry.slug, entry])).values(),
    );

    const groqKeys = Array.from(
      new Set(
        [
          providerConfig.groqApiKey,
          providerConfig.white?.groqApiKey,
          providerConfig.black?.groqApiKey,
        ].filter((value): value is string => Boolean(value?.trim())),
      ),
    );

    const groqCatalogs: Array<Awaited<ReturnType<typeof listGroqModels>>> = [];
    for (const key of groqKeys) {
      try {
        const models = await listGroqModels(key);
        groqCatalogs.push(models);
      } catch {
        // Silently skip Groq keys that fail validation — settings page shows detailed errors.
      }
    }


    const groqModels = Array.from(
      new Map(groqCatalogs.flat().map((entry) => [entry.slug, entry])).values(),
    );
    const allModels = [...openrouterModels, ...groqModels];

    return NextResponse.json({
      items: allModels.map((entry) => ({
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
