import type { Provider } from "@/lib/ai/provider-config";

export type KeyScope = "shared" | "white" | "black";

export const PROVIDER_SCOPES: KeyScope[] = ["shared", "white", "black"];

export const PROVIDER_STORAGE_KEYS: Record<KeyScope, Record<Provider, string>> = {
  shared: {
    openrouter: "chess_arena_openrouter_key",
    groq: "chess_arena_groq_key",
  },
  white: {
    openrouter: "chess_arena_white_openrouter_key",
    groq: "chess_arena_white_groq_key",
  },
  black: {
    openrouter: "chess_arena_black_openrouter_key",
    groq: "chess_arena_black_groq_key",
  },
};

export function getStorageKey(scope: KeyScope, provider: Provider): string {
  return PROVIDER_STORAGE_KEYS[scope][provider];
}