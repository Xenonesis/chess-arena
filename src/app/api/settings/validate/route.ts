import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      provider: "openrouter" | "groq";
      apiKey: string;
    };

    if (!body.provider || !body.apiKey) {
      return NextResponse.json(
        { error: "provider and apiKey are required" },
        { status: 400 },
      );
    }

    if (body.provider === "openrouter") {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          Authorization: `Bearer ${body.apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        return NextResponse.json(
          {
            valid: false,
            error: `OpenRouter rejected the key (${response.status}): ${text.slice(0, 120)}`,
          },
          { status: 200 },
        );
      }

      const data = (await response.json()) as { data?: unknown[] };
      return NextResponse.json({
        valid: true,
        modelCount: data.data?.length ?? 0,
      });
    }

    if (body.provider === "groq") {
      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: {
          Authorization: `Bearer ${body.apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        return NextResponse.json(
          {
            valid: false,
            error: `Groq rejected the key (${response.status}): ${text.slice(0, 120)}`,
          },
          { status: 200 },
        );
      }

      const data = (await response.json()) as { data?: unknown[] };
      return NextResponse.json({
        valid: true,
        modelCount: data.data?.length ?? 0,
      });
    }

    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { valid: false, error: message },
      { status: 500 },
    );
  }
}
