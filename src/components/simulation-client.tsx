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
  source: "model" | "retry";
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
  const [isStarting, setIsStarting] = useState(false);

  const runningRef = useRef(false);
  const startingRef = useRef(false);
  const runTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      // Avoid orphaned move polling after route transitions/reloads.
      runningRef.current = false;
      runTokenRef.current += 1;
    };
  }, []);

  const freeModelSlugs = useMemo(
    () => models.filter((entry) => entry.slug.includes(":free")).map((entry) => entry.slug),
    [models],
  );

  const defaultWhiteSlug = freeModelSlugs[0] || models[0]?.slug || "";
  const resolvedWhiteSlug = whiteSlug || defaultWhiteSlug;

  const defaultBlackSlug =
    freeModelSlugs.find((slug) => slug !== resolvedWhiteSlug) ||
    models.find((entry) => entry.slug !== resolvedWhiteSlug)?.slug ||
    resolvedWhiteSlug;
  const resolvedBlackSlug = blackSlug || defaultBlackSlug || "";

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
    if (startingRef.current || isRunning) {
      return;
    }

    startingRef.current = true;
    setIsStarting(true);

    const runToken = runTokenRef.current + 1;
    runTokenRef.current = runToken;
    runningRef.current = false;

    setError(null);

    if (catalogLoading) {
      setError("Model catalog is still loading.");
      startingRef.current = false;
      setIsStarting(false);
      return;
    }

    if (catalogError) {
      setError(catalogError.message);
      startingRef.current = false;
      setIsStarting(false);
      return;
    }

    if (!resolvedWhiteSlug || !resolvedBlackSlug) {
      setError("Select both models before starting the simulation.");
      startingRef.current = false;
      setIsStarting(false);
      return;
    }

    if (resolvedWhiteSlug === resolvedBlackSlug) {
      setError("Select two different models.");
      startingRef.current = false;
      setIsStarting(false);
      return;
    }

    let response: Response;
    let payload: unknown;

    try {
      response = await fetch("/api/game", {
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

      payload = await response.json();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not start game";
      setError(message);
      setStatus("error");
      startingRef.current = false;
      setIsStarting(false);
      return;
    }

    if (runTokenRef.current !== runToken) {
      startingRef.current = false;
      setIsStarting(false);
      return;
    }

    const gamePayload = payload as {
      error?: string;
      details?: string;
      gameId: string;
      currentFen: string;
      status: string;
      version: number;
    };

    if (!response.ok) {
      const message =
        gamePayload.details && gamePayload.error
          ? `${gamePayload.error}: ${gamePayload.details}`
          : gamePayload.error ?? "Could not start game";
      setError(message);
      setStatus("error");
      startingRef.current = false;
      setIsStarting(false);
      return;
    }

    setGameId(gamePayload.gameId);
    setFen(gamePayload.currentFen);
    setMoves([]);
    setStatus(gamePayload.status);
    setIsRunning(true);
    runningRef.current = true;
    startingRef.current = false;
    setIsStarting(false);

    let currentVersion = gamePayload.version;

    while (runningRef.current && runTokenRef.current === runToken) {
      let moveResponse: Response;
      let movePayload: unknown;

      try {
        moveResponse = await fetch("/api/move", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            gameId: gamePayload.gameId,
            expectedVersion: currentVersion,
          }),
        });

        movePayload = await moveResponse.json();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Move execution failed";
        setError(message);
        setStatus("error");
        runningRef.current = false;
        setIsRunning(false);
        break;
      }

      if (runTokenRef.current !== runToken) {
        break;
      }

      const stepPayload = movePayload as {
        error?: string;
        details?: string;
        move?: MoveEntry;
        state: {
          currentFen: string;
          status: string;
          version: number;
        };
      };

      if (!moveResponse.ok) {
        const message =
          stepPayload.details && stepPayload.error
            ? `${stepPayload.error}: ${stepPayload.details}`
            : stepPayload.error ?? "Move execution failed";
        setError(message);
        setStatus("error");
        runningRef.current = false;
        setIsRunning(false);
        break;
      }

      if (stepPayload.move) {
        const incoming = stepPayload.move;

        setMoves((previous) => {
          const alreadyPresent = previous.some(
            (entry) =>
              entry.ply === incoming.ply &&
              entry.uci === incoming.uci &&
              entry.playedByModelId === incoming.playedByModelId,
          );

          if (alreadyPresent) {
            return previous;
          }

          return [...previous, incoming];
        });
      }

      setFen(stepPayload.state.currentFen);
      setStatus(stepPayload.state.status);
      currentVersion = stepPayload.state.version;

      if (stepPayload.state.status !== "running") {
        runningRef.current = false;
        setIsRunning(false);
        break;
      }

      await delay(speedMs);
    }
  };

  const stopSimulation = async () => {
    runningRef.current = false;
    runTokenRef.current += 1;
    startingRef.current = false;
    setIsStarting(false);
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
            disabled={isRunning || isStarting || catalogLoading || models.length === 0}
            className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-900/50 disabled:text-emerald-200"
          >
            {isStarting ? "Starting..." : "Start Simulation"}
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
            moves.map((move, index) => (
              <div
                key={`${move.ply}-${move.uci}-${move.playedByModelId}-${index}`}
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
