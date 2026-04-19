import { requestOpenRouterMove } from "@/lib/ai/openrouter";
import { requestGroqMove } from "@/lib/ai/groq";
import type { ProviderKeySet } from "@/lib/ai/provider-config";

/**
 * Unified move dispatcher.
 * Routes to Groq if modelName starts with "groq:", otherwise OpenRouter.
 */
export async function requestMove(input: {
  fen: string;
  modelName: string;
  strict: boolean;
  legalMoves?: string[];
  providerConfig?: ProviderKeySet;
}): Promise<string> {
  if (input.modelName.startsWith("groq:")) {
    const groqModel = input.modelName.slice("groq:".length);
    const apiKey = input.providerConfig?.groqApiKey;
    if (!apiKey) {
      throw new Error("Groq API key is required to use Groq models. Add it in Settings.");
    }
    return requestGroqMove({
      fen: input.fen,
      modelName: groqModel,
      strict: input.strict,
      legalMoves: input.legalMoves,
      apiKey,
    });
  }

  return requestOpenRouterMove({
    fen: input.fen,
    modelName: input.modelName,
    strict: input.strict,
    legalMoves: input.legalMoves,
    apiKey: input.providerConfig?.openrouterApiKey,
  });
}
