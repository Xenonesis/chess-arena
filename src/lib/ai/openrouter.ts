import OpenAI from "openai";
import { getEnv } from "@/lib/config/env";

function extractTextContent(
  content:
    | OpenAI.Chat.Completions.ChatCompletionMessageParam["content"]
    | null
    | undefined,
) {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim();
}

export async function requestOpenRouterMove(input: {
  fen: string;
  modelName: string;
  strict: boolean;
  legalMoves?: string[];
  /** Override API key (from user settings). Falls back to env var. */
  apiKey?: string;
}) {
  const env = getEnv();
  const apiKey = input.apiKey ?? env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("OpenRouter API key is missing.");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: env.OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://localhost",
      "X-Title": env.OPENROUTER_APP_NAME,
    },
  });

  const strictAppendix = input.strict
    ? "Return exactly one legal UCI move. No punctuation. No explanation."
    : "Return only one best move in UCI format.";

  const legalMovesText = input.legalMoves?.length
    ? `\nLegal moves now: ${input.legalMoves.join(", ")}`
    : "";

  const completion = await client.chat.completions.create({
    model: input.modelName,
    temperature: input.strict ? 0 : 0.2,
    max_completion_tokens: 20,
    messages: [
      {
        role: "system",
        content: "You are a chess engine that responds with legal UCI moves only.",
      },
      {
        role: "user",
        content: `Board FEN: ${input.fen}\n${strictAppendix}${legalMovesText}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  return extractTextContent(content);
}
