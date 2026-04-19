"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import useSWR from "swr";
import type { ProviderConfig, ProviderKeySet } from "@/lib/ai/provider-config";
import { getStorageKey, type KeyScope } from "@/lib/config/provider-storage";

function readStoredKey(scope: KeyScope, provider: "openrouter" | "groq"): string | undefined {
  const key = localStorage.getItem(getStorageKey(scope, provider))?.trim();
  return key ? key : undefined;
}

function hasAnyKey(config: ProviderKeySet): boolean {
  return Boolean(config.openrouterApiKey || config.groqApiKey);
}

function getProviderConfig(): ProviderConfig {
  if (typeof window === "undefined") return {};

  const config: ProviderConfig = {};

  const shared: ProviderKeySet = {
    openrouterApiKey: readStoredKey("shared", "openrouter"),
    groqApiKey: readStoredKey("shared", "groq"),
  };

  const white: ProviderKeySet = {
    openrouterApiKey: readStoredKey("white", "openrouter"),
    groqApiKey: readStoredKey("white", "groq"),
  };

  const black: ProviderKeySet = {
    openrouterApiKey: readStoredKey("black", "openrouter"),
    groqApiKey: readStoredKey("black", "groq"),
  };

  if (shared.openrouterApiKey) config.openrouterApiKey = shared.openrouterApiKey;
  if (shared.groqApiKey) config.groqApiKey = shared.groqApiKey;
  if (hasAnyKey(white)) config.white = white;
  if (hasAnyKey(black)) config.black = black;

  return config;
}

function providerHeader(): HeadersInit {
  const config = getProviderConfig();
  const hasConfig =
    Boolean(config.openrouterApiKey) ||
    Boolean(config.groqApiKey) ||
    hasAnyKey(config.white ?? {}) ||
    hasAnyKey(config.black ?? {});

  if (!hasConfig) return {};
  return { "x-provider-config": JSON.stringify(config) };
}

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
  { ssr: false },
);

const fetcher = async (url: string) => {
  const response = await fetch(url, { headers: providerHeader() });
  const payload = (await response.json()) as CatalogResponse;
  if (!response.ok) {
    throw new Error(
      (payload as { details?: string; error?: string }).details ??
        "Failed to load model catalog",
    );
  }
  return payload;
};

/* ─── Status badge colors ─── */
function statusStyle(status: string): React.CSSProperties {
  if (status === "running")
    return { background: "var(--accent-dim)", color: "var(--accent)", borderColor: "var(--accent-border)" };
  if (status === "error" || status === "aborted")
    return { background: "var(--danger-dim)", color: "var(--danger)", borderColor: "rgba(248,113,113,0.28)" };
  if (["checkmate", "stalemate", "draw"].includes(status))
    return { background: "rgba(251,191,36,0.1)", color: "var(--warning)", borderColor: "rgba(251,191,36,0.25)" };
  return {
    background: "var(--surface-soft)",
    color: "var(--text-secondary)",
    borderColor: "var(--border-strong)",
  };
}

/* ─── Field label ─── */
function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "grid",
        gap: 6,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
      }}
    >
      {children}
    </label>
  );
}

/* ─── Icon button ─── */
function Btn({
  children,
  onClick,
  disabled,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "accent" | "danger" | "default";
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "8px 18px",
    borderRadius: 6,
    fontSize: 13.5,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid transparent",
    transition: "opacity 0.15s, transform 0.12s",
    fontFamily: "var(--font-dm-sans), sans-serif",
    letterSpacing: "0.02em",
  };

  const styles: Record<string, React.CSSProperties> = {
    accent: {
      ...base,
      background: disabled ? "rgba(74,222,128,0.12)" : "var(--accent)",
      color: disabled ? "var(--accent)" : "var(--accent-contrast)",
      opacity: disabled ? 0.45 : 1,
    },
    danger: {
      ...base,
      background: disabled ? "var(--danger-dim)" : "var(--danger)",
      color: disabled ? "var(--danger)" : "var(--danger-contrast)",
      opacity: disabled ? 0.45 : 1,
    },
    default: {
      ...base,
      background: "transparent",
      border: "1px solid var(--border-strong)",
      color: disabled ? "var(--text-muted)" : "var(--text-secondary)",
      opacity: disabled ? 0.4 : 1,
    },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={styles[variant]}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = "0.82";
      }}
      onMouseLeave={(e) => {
        if (!disabled) (e.currentTarget as HTMLButtonElement).style.opacity = "1";
      }}
    >
      {children}
    </button>
  );
}

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
  const moveListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      runTokenRef.current += 1;
    };
  }, []);

  /* Auto-scroll move list */
  useEffect(() => {
    if (moveListRef.current) {
      moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
    }
  }, [moves]);

  const freeModelSlugs = useMemo(
    () =>
      models
        .filter((entry) => entry.slug.includes(":free"))
        .map((entry) => entry.slug),
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

  const whiteOptions = useMemo(() => {
    const normalized = whiteSearch.trim().toLowerCase();
    const filtered = !normalized
      ? models
      : models.filter((entry) => {
          const haystack =
            `${entry.name} ${entry.provider} ${entry.openrouterModel}`.toLowerCase();
          return haystack.includes(normalized);
        });
    if (
      !resolvedWhiteSlug ||
      filtered.some((entry) => entry.slug === resolvedWhiteSlug)
    ) {
      return filtered;
    }
    const selected = models.find((entry) => entry.slug === resolvedWhiteSlug);
    return selected ? [selected, ...filtered] : filtered;
  }, [models, whiteSearch, resolvedWhiteSlug]);

  const blackOptions = useMemo(() => {
    const normalized = blackSearch.trim().toLowerCase();
    const filtered = !normalized
      ? models
      : models.filter((entry) => {
          const haystack =
            `${entry.name} ${entry.provider} ${entry.openrouterModel}`.toLowerCase();
          return haystack.includes(normalized);
        });
    if (
      !resolvedBlackSlug ||
      filtered.some((entry) => entry.slug === resolvedBlackSlug)
    ) {
      return filtered;
    }
    const selected = models.find((entry) => entry.slug === resolvedBlackSlug);
    return selected ? [selected, ...filtered] : filtered;
  }, [models, blackSearch, resolvedBlackSlug]);

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const startSimulation = async () => {
    if (startingRef.current || isRunning) return;

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
        headers: { "Content-Type": "application/json", ...providerHeader() },
        body: JSON.stringify({
          whiteModelSlug: resolvedWhiteSlug,
          blackModelSlug: resolvedBlackSlug,
          maxPlies,
        }),
      });
      payload = await response.json();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not start game";
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
          headers: { "Content-Type": "application/json", ...providerHeader() },
          body: JSON.stringify({
            gameId: gamePayload.gameId,
            expectedVersion: currentVersion,
          }),
        });
        movePayload = await moveResponse.json();
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Move execution failed";
        setError(message);
        setStatus("error");
        runningRef.current = false;
        setIsRunning(false);
        break;
      }

      if (runTokenRef.current !== runToken) break;

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
          if (alreadyPresent) return previous;
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
      headers: { "Content-Type": "application/json" },
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

  /* Current player (ply count → whose turn) */
  const currentPlayer =
    moves.length % 2 === 0 ? "White" : "Black";
  const currentModelName =
    moves.length % 2 === 0
      ? whiteModel?.name ?? "White"
      : blackModel?.name ?? "Black";

  return (
    <div
      style={{
        display: "grid",
        gap: 16,
        gridTemplateColumns: "1fr",
      }}
    >
      {/* Main layout: board + right panel */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          alignItems: "start",
        }}
        className="sim-grid"
      >
        {/* ── Left: Board panel ── */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {/* Board header */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {isRunning && (
                <span
                  className="live-dot"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    flexShrink: 0,
                  }}
                />
              )}
              <span
                style={{
                  fontFamily: "var(--font-playfair), Georgia, serif",
                  fontWeight: 600,
                  fontSize: 16,
                  color: "var(--text-primary)",
                }}
              >
                Live Arena
              </span>
            </div>

            {/* Status badge */}
            <span
              className="badge"
              style={{
                ...statusStyle(status),
                borderStyle: "solid",
                borderWidth: 1,
              }}
            >
              {status}
            </span>
          </div>

          {/* Black model label */}
          <div
            style={{
              padding: "10px 20px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderBottom: "1px solid var(--border)",
              background: isRunning && currentPlayer === "Black"
                ? "rgba(74,222,128,0.04)"
                : "transparent",
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                background: "#222",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 3,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1 }}>
              {blackModel?.name ?? "Black"}{" "}
              {blackModel?.provider ? (
                <span style={{ color: "var(--text-muted)" }}>
                  · {blackModel.provider}
                </span>
              ) : null}
            </span>
            {isRunning && currentPlayer === "Black" && (
              <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
                Thinking…
              </span>
            )}
          </div>

          {/* Chess board */}
          <div style={{ padding: 16 }}>
            <div
              style={{
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid var(--border)",
              }}
            >
              <Chessboard
                options={{
                  position: fen,
                  allowDragging: false,
                }}
              />
            </div>
          </div>

          {/* White model label */}
          <div
            style={{
              padding: "10px 20px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderTop: "1px solid var(--border)",
              background: isRunning && currentPlayer === "White"
                ? "rgba(74,222,128,0.04)"
                : "transparent",
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                background: "#e8e8e8",
                border: "1px solid rgba(0,0,0,0.2)",
                borderRadius: 3,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1 }}>
              {whiteModel?.name ?? "White"}{" "}
              {whiteModel?.provider ? (
                <span style={{ color: "var(--text-muted)" }}>
                  · {whiteModel.provider}
                </span>
              ) : null}
            </span>
            {isRunning && currentPlayer === "White" && (
              <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
                Thinking…
              </span>
            )}
          </div>

          {/* Error message */}
          {(error || catalogError) && (
            <div
              style={{
                margin: "0 16px 16px",
                padding: "10px 14px",
                borderRadius: 6,
                border: "1px solid rgba(248,113,113,0.25)",
                background: "var(--danger-dim)",
                fontSize: 13,
                color: "var(--danger)",
                lineHeight: 1.5,
              }}
            >
              {error ?? catalogError?.message}
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <div style={{ display: "grid", gap: 16 }}>
          {/* Config card */}
          <div
            style={{
              background: "linear-gradient(160deg, var(--surface), var(--surface-raised))",
              border: "1px solid var(--border)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.14)",
              borderRadius: 12,
              padding: "24px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Subtle glow effect behind config */}
            <div style={{
              position: "absolute",
              top: 0, left: "50%",
              transform: "translateX(-50%)",
              width: "80%", height: 1,
              background: "linear-gradient(90deg, transparent, var(--accent-border), transparent)"
            }}/>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: 18,
              }}
            >
              Configuration
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* White model */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <div style={{
                    width: 22, height: 22, background: "linear-gradient(135deg, #ffffff, #e8e8e8)", borderRadius: 5,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(255,255,255,0.15), inset 0 1px 0 rgba(255,255,255,0.5)"
                  }}>
                    <span style={{ color: "#0b0d10", fontSize: 14, lineHeight: 1, filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.2))" }}>♔</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-primary)" }}>White Player</span>
                </div>
                <div style={{ position: "relative" }}>
                  <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <input
                    type="text"
                    value={whiteSearch}
                    onChange={(e) => setWhiteSearch(e.target.value)}
                    placeholder="Search model catalog…"
                    disabled={catalogLoading || models.length === 0}
                    style={{ paddingLeft: 30, background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "6px" }}
                  />
                </div>
                <select
                  value={resolvedWhiteSlug}
                  onChange={(e) => setWhiteSlug(e.target.value)}
                  disabled={catalogLoading || models.length === 0}
                  style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", marginTop: -2 }}
                  title={whiteModel ? `${whiteModel.name} · ${whiteModel.provider}` : "Select White Model"}
                >
                  {whiteOptions.length === 0 ? (
                    <option value="">No models match</option>
                  ) : (
                    whiteOptions.map((model) => (
                      <option key={model.id} value={model.slug}>
                        {model.name} · {model.provider}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Black model */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <div style={{
                    width: 22, height: 22, background: "linear-gradient(135deg, #333333, #1a1a1a)", borderRadius: 5,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.1)"
                  }}>
                    <span style={{ color: "#ececec", fontSize: 13, lineHeight: 1 }}>♚</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-primary)" }}>Black Player</span>
                </div>
                <div style={{ position: "relative" }}>
                  <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <input
                    type="text"
                    value={blackSearch}
                    onChange={(e) => setBlackSearch(e.target.value)}
                    placeholder="Search model catalog…"
                    disabled={catalogLoading || models.length === 0}
                    style={{ paddingLeft: 30, background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "6px" }}
                  />
                </div>
                <select
                  value={resolvedBlackSlug}
                  onChange={(e) => setBlackSlug(e.target.value)}
                  disabled={catalogLoading || models.length === 0}
                  style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", marginTop: -2 }}
                  title={blackModel ? `${blackModel.name} · ${blackModel.provider}` : "Select Black Model"}
                >
                  {blackOptions.length === 0 ? (
                    <option value="">No models match</option>
                  ) : (
                    blackOptions.map((model) => (
                      <option key={model.id} value={model.slug}>
                        {model.name} · {model.provider}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Controls row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 4 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Max Plies
                  </span>
                  <input
                    type="number"
                    min={20}
                    max={400}
                    value={maxPlies}
                    onChange={(e) => setMaxPlies(Number(e.target.value))}
                    style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Turn Delay
                  </span>
                  <select
                    value={speedMs}
                    onChange={(e) => setSpeedMs(Number(e.target.value))}
                    style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
                  >
                    <option value={250}>Fast</option>
                    <option value={900}>Balanced</option>
                    <option value={1500}>Slow</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 20,
                flexWrap: "wrap",
              }}
            >
              <Btn
                variant="accent"
                onClick={() => void startSimulation()}
                disabled={
                  isRunning || isStarting || catalogLoading || models.length === 0
                }
                style={{ flex: 1, boxShadow: "0 4px 14px rgba(74, 222, 128, 0.25)" }}
              >
                {isStarting ? (
                  <>
                    <span
                      className="spin"
                      style={{
                        display: "inline-block",
                        width: 14,
                        height: 14,
                        borderStyle: "solid",
                        borderWidth: 2,
                        borderColor: "rgba(0,0,0,0.15)",
                        borderTopColor: "var(--accent-contrast)",
                        borderRadius: "50%",
                      }}
                    />
                    Starting
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    Start Game
                  </div>
                )}
              </Btn>

              <Btn
                variant="danger"
                onClick={stopSimulation}
                disabled={!isRunning}
                style={{ flex: 1 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
                  Stop
                </div>
              </Btn>

              <Btn onClick={() => void refreshCatalog()} variant="default" style={{ padding: "8px 12px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              </Btn>
            </div>
          </div>

          {/* Move history card */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                Move History
              </span>
              {moves.length > 0 && (
                <span
                  style={{
                    background: "var(--inline-code-bg)",
                    borderRadius: 4,
                    padding: "2px 8px",
                    fontSize: 11,
                    color: "var(--text-muted)",
                    fontWeight: 500,
                  }}
                >
                  {moves.length}
                </span>
              )}
            </div>

            <div
              ref={moveListRef}
              style={{
                maxHeight: 400,
                overflowY: "auto",
                padding: "8px",
              }}
            >
              {moves.length === 0 ? (
                <p
                  style={{
                    padding: "20px 12px",
                    fontSize: 13,
                    color: "var(--text-muted)",
                    textAlign: "center",
                    lineHeight: 1.5,
                  }}
                >
                  No moves yet.
                  <br />
                  <span style={{ color: "var(--text-secondary)", opacity: 0.6 }}>
                    Start a game to stream turns.
                  </span>
                </p>
              ) : (
                <div style={{ display: "grid", gap: 2 }}>
                  {moves.map((move, index) => {
                    const isWhite = move.ply % 2 === 1;
                    return (
                      <div
                        key={`${move.ply}-${move.uci}-${move.playedByModelId}-${index}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 10px",
                          borderRadius: 5,
                          background:
                            index === moves.length - 1
                              ? "rgba(74,222,128,0.06)"
                              : "transparent",
                          border:
                            index === moves.length - 1
                              ? "1px solid rgba(74,222,128,0.12)"
                              : "1px solid transparent",
                          transition: "background 0.1s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* Ply indicator */}
                          <span
                            style={{
                              fontSize: 10,
                              width: 28,
                              color: "var(--text-muted)",
                              fontWeight: 500,
                              flexShrink: 0,
                            }}
                          >
                            {Math.ceil(move.ply / 2)}{isWhite ? "." : "…"}
                          </span>
                          {/* Color dot */}
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: isWhite ? "#e8e8e8" : "#333",
                              border: isWhite
                                ? "1px solid rgba(0,0,0,0.15)"
                                : "1px solid rgba(255,255,255,0.12)",
                              flexShrink: 0,
                            }}
                          />
                          {/* Move in SAN */}
                          <span
                            style={{
                              fontSize: 13.5,
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              fontFamily: "'Courier New', monospace",
                              letterSpacing: "-0.01em",
                            }}
                          >
                            {move.san}
                          </span>
                        </div>

                        {/* Source badge */}
                        {move.source === "retry" && (
                          <span
                            style={{
                              fontSize: 9.5,
                              fontWeight: 600,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              color: "var(--warning)",
                              background: "rgba(251,191,36,0.08)",
                              borderRadius: 3,
                              padding: "2px 5px",
                              border: "1px solid rgba(251,191,36,0.2)",
                            }}
                          >
                            retry
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Game stats card — show when a game is active or completed */}
          {(isRunning || moves.length > 0) && (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "16px",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 14,
                }}
              >
                Game Stats
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Total Plies", value: moves.length },
                  {
                    label: "Full Moves",
                    value: Math.ceil(moves.length / 2),
                  },
                  {
                    label: "Retries",
                    value: moves.filter((m) => m.source === "retry").length,
                  },
                  {
                    label: "Turn",
                    value: isRunning ? currentModelName : "—",
                  },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p
                      style={{
                        fontSize: 10.5,
                        color: "var(--text-muted)",
                        fontWeight: 500,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        marginBottom: 3,
                      }}
                    >
                      {label}
                    </p>
                    <p
                      style={{
                        fontSize: 18,
                        fontFamily: "var(--font-playfair), Georgia, serif",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Responsive styles injected once */}
      <style>{`
        @media (max-width: 900px) {
          .sim-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
