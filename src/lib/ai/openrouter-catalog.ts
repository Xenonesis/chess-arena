import type { ModelCatalogEntry } from "@/lib/ai/model-catalog";
import { getEnv } from "@/lib/config/env";

type OpenRouterModelsResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    top_provider?: {
      name?: string;
    };
  }>;
};

const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

let cachedCatalog: {
  expiresAt: number;
  items: ModelCatalogEntry[];
  keyUsed: string;
} | null = null;

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(" ");
}

function inferProvider(modelId: string, providerName?: string) {
  if (providerName && providerName.trim()) {
    return providerName.trim();
  }

  const provider = modelId.split("/")[0]?.trim();
  return provider ? titleCase(provider) : "OpenRouter";
}

function inferName(modelId: string, displayName?: string) {
  if (displayName && displayName.trim()) {
    return displayName.trim();
  }

  const modelName = modelId.split("/")[1] ?? modelId;
  return titleCase(modelName.replace(/\./g, " "));
}

export async function listOpenRouterCatalog(overrideApiKey?: string) {
  const now = Date.now();
  const env = getEnv();
  const apiKey = overrideApiKey ?? env.OPENROUTER_API_KEY ?? "";

  if (
    cachedCatalog &&
    cachedCatalog.expiresAt > now &&
    cachedCatalog.keyUsed === apiKey
  ) {
    return cachedCatalog.items;
  }

  const headers = new Headers({
    "Content-Type": "application/json",
    "HTTP-Referer": "https://localhost",
    "X-Title": env.OPENROUTER_APP_NAME,
  });

  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }

  const response = await fetch(
    `${normalizeBaseUrl(env.OPENROUTER_BASE_URL)}/models`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `OpenRouter model catalog request failed (${response.status}): ${details.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as OpenRouterModelsResponse;
  const dedupedById = new Map<string, ModelCatalogEntry>();

  for (const item of payload.data ?? []) {
    const id = item.id?.trim();
    if (!id) {
      continue;
    }

    dedupedById.set(id, {
      slug: id,
      name: inferName(id, item.name),
      provider: inferProvider(id, item.top_provider?.name),
      openrouterModel: id,
    });
  }

  const items = Array.from(dedupedById.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  cachedCatalog = {
    expiresAt: now + CATALOG_CACHE_TTL_MS,
    items,
    keyUsed: apiKey,
  };

  return items;
}

export async function getOpenRouterModelBySlug(
  slug: string,
  overrideApiKey?: string,
) {
  const catalog = await listOpenRouterCatalog(overrideApiKey);
  return catalog.find((entry) => entry.slug === slug) ?? null;
}
