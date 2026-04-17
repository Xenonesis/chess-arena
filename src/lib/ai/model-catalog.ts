export type ModelCatalogEntry = {
  slug: string;
  name: string;
  provider: string;
  openrouterModel: string;
};

export const DEFAULT_MODEL_CATALOG: ModelCatalogEntry[] = [
  {
    slug: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    openrouterModel: "openai/gpt-4o-mini",
  },
  {
    slug: "claude-3-5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    openrouterModel: "anthropic/claude-3.5-haiku",
  },
  {
    slug: "gemini-2-0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    openrouterModel: "google/gemini-2.0-flash-exp",
  },
];

export const MODEL_CATALOG_BY_SLUG = new Map(
  DEFAULT_MODEL_CATALOG.map((entry) => [entry.slug, entry]),
);
