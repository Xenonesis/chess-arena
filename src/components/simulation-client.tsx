"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

export type CatalogModel = {
  id: string;
  slug: string;
  name: string;
  provider: string;
  openrouterModel: string;
};

type CatalogResponse = {
  items: CatalogModel[];
};

type MoveEntry = {
  ply: number;
  uci: string;
  san: string;
  source: "model" | "retry" | "fallback";
  playedByModelId: string;
};

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const Chessboard = dynamic(
  () => import("react-chessboard").then((module) => module.Chessboard),
  {
    ssr: false,
  },
);

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const payload = (await response.json()) as CatalogResponse;

  if (!response.ok) {
    throw new Error((payload as { details?: string; error?: string }).details ?? "Failed to load model catalog");
  }

  return payload;
};

export function SimulationClient() {
  const {
    data: catalog,
    error: catalogError,
    isLoading: catalogLoading,
    mutate: refreshCatalog,
  } = useSWR<CatalogResponse>("/api/models", fetcher, {
    revalidateOnFocus: true,
  });

  const models = useMemo(() => catalog?.items ?? [], [catalog]);
  const [whiteSlug, setWhiteSlug] = useState("");
  const [blackSlug, setBlackSlug] = useState("");
  const [whiteSearch, setWhiteSearch] = useState("");
  const [blackSearch, setBlackSearch] = useState("");
  const [maxPlies, setMaxPlies] = useState(200);
  const [speedMs, setSpeedMs] = useState(900);
  const [fen, setFen] = useState(STARTING_FEN);
  const [moves, setMoves] = useState<MoveEntry[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runningRef = useRef(false);

  useEffect(() => {
    return () => {
      // Avoid orphaned move polling after route transitions/reloads.
      runningRef.current = false;
    };
  }, []);

  const preferredWhiteSlug = useMemo(() => {
    const preferred = [
      "openrouter/free",
      "openrouter/auto",
      "google/gemma-3-4b-it:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "qwen/qwen3-next-80b-a3b-instruct:free",
      "gpt-4o-mini",
      "openai/gpt-4o-mini",
      "claude-3-5-haiku",
      "anthropic/claude-3-haiku",
    ];

    for (const slug of preferred) {
      if (models.some((entry) => entry.slug === slug)) {
        return slug;
      }
    }

    return models[0]?.slug ?? "";
  }, [models]);

  const preferredBlackSlug = useMemo(() => {
    const preferred = [
      "openrouter/auto",
      "openrouter/free",
      "google/gemma-3-12b-it:free",
      "google/gemma-3-27b-it:free",
      "qwen/qwen3-coder:free",
      "claude-3-5-haiku",
      "anthropic/claude-3-haiku",
      "google/gemini-2.0-flash-001",
      "gemini-2-0-flash",
      "gpt-4o-mini",
    ];

    for (const slug of preferred) {
      if (models.some((entry) => entry.slug === slug)) {
        return slug;
      }
    }

    return models[1]?.slug ?? models[0]?.slug ?? "";
  }, [models]);

  const resolvedWhiteSlug = whiteSlug || preferredWhiteSlug || "";
  const fallbackBlackSlug =
    models.find((entry) => entry.slug !== resolvedWhiteSlug)?.slug ||
    resolvedWhiteSlug;
  const resolvedBlackSlug =
    blackSlug ||
    (preferredBlackSlug && preferredBlackSlug !== resolvedWhiteSlug
      ? preferredBlackSlug
      : fallbackBlackSlug) ||
    "";

  const whiteModel = useMemo(
    () => models.find((entry) => entry.slug === resolvedWhiteSlug),
    [models, resolvedWhiteSlug],
  );

  const blackModel = useMemo(
    () => models.find((entry) => entry.slug === resolvedBlackSlug),
    [models, resolvedBlackSlug],
  );

  const whiteOptions = useMemo(
    () => {
      const normalized = whiteSearch.trim().toLowerCase();
      const filtered = !normalized
        ? models
        : models.filter((entry) => {
            const haystack = `${entry.name} ${entry.provider} ${entry.openrouterModel}`.toLowerCase();
            return haystack.includes(normalized);
          });

      if (!resolvedWhiteSlug || filtered.some((entry) => entry.slug === resolvedWhiteSlug)) {
        return filtered;
      }

      const selected = models.find((entry) => entry.slug === resolvedWhiteSlug);
      return selected ? [selected, ...filtered] : filtered;
    },
    [models, whiteSearch, resolvedWhiteSlug],
  );

  const blackOptions = useMemo(
    () => {
      const normalized = blackSearch.trim().toLowerCase();
      const filtered = !normalized
        ? models
        : models.filter((entry) => {
            const haystack = `${entry.name} ${entry.provider} ${entry.openrouterModel}`.toLowerCase();
            return haystack.includes(normalized);
          });

      if (!resolvedBlackSlug || filtered.some((entry) => entry.slug === resolvedBlackSlug)) {
        return filtered;
      }

      const selected = models.find((entry) => entry.slug === resolvedBlackSlug);
      return selected ? [selected, ...filtered] : filtered;
    },
    [models, blackSearch, resolvedBlackSlug],
  );

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const startSimulation = async () => {
    setError(null);

    if (catalogLoading) {
      setError("Model catalog is still loading.");
      return;
    }

    if (catalogError) {
      setError(catalogError.message);
      return;
    }

    if (!resolvedWhiteSlug || !resolvedBlackSlug) {
      setError("Select both models before starting the simulation.");
      return;
    }

    if (resolvedWhiteSlug === resolvedBlackSlug) {
      setError("Select two different models.");
      return;
    }

    const response = await fetch("/api/game", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        whiteModelSlug: resolvedWhiteSlug,
        blackModelSlug: resolvedBlackSlug,
        maxPlies,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Could not start game");
      return;
    }

    setGameId(payload.gameId);
    setFen(payload.currentFen);
    setMoves([]);
    setStatus(payload.status);
    setIsRunning(true);
    runningRef.current = true;

    let currentVersion = payload.version as number;

    while (runningRef.current) {
      const moveResponse = await fetch("/api/move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId: payload.gameId,
          expectedVersion: currentVersion,
        }),
      });

      const movePayload = await moveResponse.json();

      if (!moveResponse.ok) {
        const message =
          movePayload.details && movePayload.error
            ? `${movePayload.error}: ${movePayload.details}`
            : movePayload.error ?? "Move execution failed";
        setError(message);
        setStatus("error");
        runningRef.current = false;
        setIsRunning(false);
        break;
      }

      if (movePayload.move) {
        setMoves((previous) => [...previous, movePayload.move as MoveEntry]);
      }

      setFen(movePayload.state.currentFen);
      setStatus(movePayload.state.status);
      currentVersion = movePayload.state.version;

      if (movePayload.state.status !== "running") {
        runningRef.current = false;
        setIsRunning(false);
        break;
      }

      await delay(speedMs);
    }
  };

  const stopSimulation = async () => {
    runningRef.current = false;
    setIsRunning(false);

    if (!gameId) {
      setStatus("idle");
      return;
    }

    const response = await fetch("/api/result", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameId,
        result: "aborted",
        terminationReason: "manual_stop",
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Failed to stop game cleanly");
      return;
    }

    setStatus(payload.status ?? "aborted");
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="rounded-2xl border border-stone-700/40 bg-stone-950/70 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-wide text-stone-100">
            Live Arena
          </h2>
          <p className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-amber-200">
            Status: {status}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-stone-700/50">
          <Chessboard
            options={{
              position: fen,
              allowDragging: false,
            }}
          />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm text-stone-300">
            White model
            <input
              type="text"
              value={whiteSearch}
              onChange={(event) => setWhiteSearch(event.target.value)}
              placeholder="Search OpenRouter models..."
              className="rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-stone-100 placeholder:text-stone-500"
              disabled={catalogLoading || models.length === 0}
            />
            <select
              className="rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-stone-100"
              value={resolvedWhiteSlug}
              onChange={(event) => setWhiteSlug(event.target.value)}
              disabled={catalogLoading || models.length === 0}
            >
              {whiteOptions.length === 0 ? (
                <option value="">No models match search</option>
              ) : (
                whiteOptions.map((model) => (
                  <option key={model.id} value={model.slug}>
                    {model.name} ({model.provider})
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="grid gap-1 text-sm text-stone-300">
            Black model
            <input
              type="text"
              value={blackSearch}
              onChange={(event) => setBlackSearch(event.target.value)}
              placeholder="Search OpenRouter models..."
              className="rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-stone-100 placeholder:text-stone-500"
              disabled={catalogLoading || models.length === 0}
            />
            <select
              className="rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-stone-100"
              value={resolvedBlackSlug}
              onChange={(event) => setBlackSlug(event.target.value)}
              disabled={catalogLoading || models.length === 0}
            >
              {blackOptions.length === 0 ? (
                <option value="">No models match search</option>
              ) : (
                blackOptions.map((model) => (
                  <option key={model.id} value={model.slug}>
                    {model.name} ({model.provider})
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="grid gap-1 text-sm text-stone-300">
            Max plies
            <input
              type="number"
              min={20}
              max={400}
              value={maxPlies}
              onChange={(event) => setMaxPlies(Number(event.target.value))}
              className="rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-stone-100"
            />
          </label>

          <label className="grid gap-1 text-sm text-stone-300">
            Turn delay
            <select
              className="rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-stone-100"
              value={speedMs}
              onChange={(event) => setSpeedMs(Number(event.target.value))}
            >
              <option value={250}>Fast</option>
              <option value={900}>Balanced</option>
              <option value={1500}>Slow</option>
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void startSimulation()}
            disabled={isRunning || catalogLoading || models.length === 0}
            className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-900/50 disabled:text-emerald-200"
          >
            Start Simulation
          </button>

          <button
            type="button"
            onClick={stopSimulation}
            disabled={!isRunning}
            className="rounded-lg bg-rose-500 px-4 py-2 font-semibold text-rose-950 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:bg-rose-900/50 disabled:text-rose-200"
          >
            Stop
          </button>

          <button
            type="button"
            onClick={() => void refreshCatalog()}
            className="rounded-lg border border-stone-500 px-4 py-2 font-semibold text-stone-200 transition hover:border-stone-300"
          >
            Refresh Models
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-400/40 bg-rose-900/20 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        {!error && catalogError ? (
          <p className="mt-4 rounded-lg border border-rose-400/40 bg-rose-900/20 px-3 py-2 text-sm text-rose-200">
            {catalogError.message}
          </p>
        ) : null}

        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-stone-400">
          {whiteModel?.name ?? "White"} vs {blackModel?.name ?? "Black"}
        </p>
      </div>

      <aside className="rounded-2xl border border-stone-700/40 bg-stone-950/70 p-5 shadow-[0_12px_45px_rgba(0,0,0,0.3)] backdrop-blur-sm">
        <h3 className="mb-3 text-lg font-semibold text-stone-100">Move History</h3>
        <div className="max-h-[530px] space-y-2 overflow-auto pr-1">
          {moves.length === 0 ? (
            <p className="text-sm text-stone-400">No moves yet. Start a game to stream turns.</p>
          ) : (
            moves.map((move) => (
              <div
                key={`${move.ply}-${move.uci}`}
                className="flex items-center justify-between rounded-lg border border-stone-700/50 bg-stone-900/70 px-3 py-2 text-sm"
              >
                <span className="font-medium text-stone-200">{move.ply}. {move.san}</span>
                <span className="rounded-full border border-stone-600 px-2 py-0.5 text-xs uppercase text-stone-300">
                  {move.source}
                </span>
              </div>
            ))
          )}
        </div>
      </aside>
    </section>
  );
}
