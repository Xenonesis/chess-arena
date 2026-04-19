export type Provider = "openrouter" | "groq";

export type Side = "white" | "black";

export type ProviderKeySet = {
  openrouterApiKey?: string;
  groqApiKey?: string;
};

export type ProviderConfig = ProviderKeySet & {
  white?: ProviderKeySet;
  black?: ProviderKeySet;
};

export function mergeProviderConfigForSide(
  config: ProviderConfig | undefined,
  side: Side,
): ProviderKeySet {
  const sideConfig = config?.[side];

  return {
    openrouterApiKey: sideConfig?.openrouterApiKey ?? config?.openrouterApiKey,
    groqApiKey: sideConfig?.groqApiKey ?? config?.groqApiKey,
  };
}

export function firstDefinedString(
  ...values: Array<string | undefined>
): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim().length > 0);
}