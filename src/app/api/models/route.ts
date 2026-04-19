import { NextRequest, NextResponse } from "next/server";
import { listOpenRouterCatalog } from "@/lib/ai/openrouter-catalog";
import { listGroqModels } from "@/lib/ai/groq";

export const runtime = "nodejs";

function parseProviderConfig(request: NextRequest) {
  try {
    const raw = request.headers.get("x-provider-config");
    if (!raw) return {} as Record<string, string>;
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

export async function GET(request: NextRequest) {
  try {
    const providerConfig = parseProviderConfig(request);

    const openrouterModels = await listOpenRouterCatalog(
      providerConfig.openrouterApiKey,
    );

    let groqModels: Awaited<ReturnType<typeof listGroqModels>> = [];
    if (providerConfig.groqApiKey) {
      try {
        groqModels = await listGroqModels(providerConfig.groqApiKey);
      } catch {
        // Silently skip Groq if key is invalid — error shown in settings
      }
    }

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
