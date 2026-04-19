import OpenAI from "openai";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

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

export async function requestGroqMove(input: {
  fen: string;
  modelName: string;
  strict: boolean;
  legalMoves?: string[];
  apiKey: string;
}) {
  if (!input.apiKey) {
    throw new Error("Groq API key is missing.");
  }

  const client = new OpenAI({
    apiKey: input.apiKey,
    baseURL: GROQ_BASE_URL,
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
    max_tokens: 20,
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

export async function listGroqModels(apiKey: string) {
  const response = await fetch(`${GROQ_BASE_URL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Groq model list failed (${response.status}): ${details.slice(0, 200)}`,
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{ id?: string; owned_by?: string }>;
  };

  return (payload.data ?? [])
    .filter((m) => m.id && !m.id.includes("whisper") && !m.id.includes("tts"))
    .map((m) => ({
      slug: `groq:${m.id!}`,
      name: formatGroqModelName(m.id!),
      provider: "Groq",
      openrouterModel: m.id!,
      groqModel: m.id!,
      source: "groq" as const,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function formatGroqModelName(id: string): string {
  return id
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+\d{8}$/, "")
    .trim();
}
