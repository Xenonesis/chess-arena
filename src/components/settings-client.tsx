"use client";

import { useEffect, useState, useCallback } from "react";

type Provider = "openrouter" | "groq";

type KeyState = {
  value: string;
  saved: boolean;
  validating: boolean;
  status: "idle" | "valid" | "invalid" | "error";
  message: string;
  modelCount?: number;
};

const STORAGE_KEYS = {
  openrouter: "chess_arena_openrouter_key",
  groq: "chess_arena_groq_key",
} as const;

function useProviderKey(provider: Provider) {
  const storageKey = STORAGE_KEYS[provider];

  const [state, setState] = useState<KeyState>({
    value: "",
    saved: false,
    validating: false,
    status: "idle",
    message: "",
  });

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) ?? "";
    setState((prev) => ({ ...prev, value: stored, saved: !!stored }));
  }, [storageKey]);

  const validate = useCallback(
    async (key: string) => {
      if (!key.trim()) return;
      setState((prev) => ({ ...prev, validating: true, status: "idle", message: "" }));
      try {
        const response = await fetch("/api/settings/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, apiKey: key.trim() }),
        });
        const data = (await response.json()) as {
          valid?: boolean;
          error?: string;
          modelCount?: number;
        };
        if (data.valid) {
          setState((prev) => ({
            ...prev,
            validating: false,
            status: "valid",
            message: `Key valid — ${data.modelCount ?? "?"} models available`,
            modelCount: data.modelCount,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            validating: false,
            status: "invalid",
            message: data.error ?? "Key appears invalid",
          }));
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          validating: false,
          status: "error",
          message: err instanceof Error ? err.message : "Network error",
        }));
      }
    },
    [provider],
  );

  const save = useCallback(() => {
    const trimmed = state.value.trim();
    localStorage.setItem(storageKey, trimmed);
    setState((prev) => ({ ...prev, saved: true }));
    void validate(trimmed);
  }, [state.value, storageKey, validate]);

  const clear = useCallback(() => {
    localStorage.removeItem(storageKey);
    setState({ value: "", saved: false, validating: false, status: "idle", message: "" });
  }, [storageKey]);

  const onChange = useCallback((value: string) => {
    setState((prev) => ({ ...prev, value, saved: false, status: "idle", message: "" }));
  }, []);

  return { state, save, clear, onChange, validate };
}

/* ── Status indicator ── */
function StatusChip({ status, message }: { status: KeyState["status"]; message: string }) {
  if (status === "idle" || !message) return null;

  const styles: Record<string, React.CSSProperties> = {
    valid: { color: "var(--accent)", background: "var(--accent-dim)", borderColor: "var(--accent-border)" },
    invalid: { color: "var(--danger)", background: "var(--danger-dim)", borderColor: "rgba(248,113,113,0.25)" },
    error: { color: "var(--warning)", background: "rgba(251,191,36,0.08)", borderColor: "rgba(251,191,36,0.2)" },
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 7,
        padding: "9px 12px",
        borderRadius: 6,
        border: "1px solid",
        fontSize: 13,
        lineHeight: 1.45,
        marginTop: 10,
        ...(styles[status] ?? {}),
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>
        {status === "valid" ? "✓" : status === "invalid" ? "✗" : "⚠"}
      </span>
      <span>{message}</span>
    </div>
  );
}

/* ── Key input section for one provider ── */
function ProviderCard({
  title,
  provider,
  logo,
  docsUrl,
  placeholder,
  description,
}: {
  title: string;
  provider: Provider;
  logo: string;
  docsUrl: string;
  placeholder: string;
  description: string;
}) {
  const { state, save, clear, onChange } = useProviderKey(provider);
  const [showKey, setShowKey] = useState(false);

  const hasKey = !!state.value.trim();

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{logo}</span>
          <div>
            <p
              style={{
                fontFamily: "var(--font-playfair), Georgia, serif",
                fontWeight: 600,
                fontSize: 15,
                color: "var(--text-primary)",
                lineHeight: 1.2,
              }}
            >
              {title}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
              {description}
            </p>
          </div>
        </div>

        {/* Status pill */}
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            padding: "3px 9px",
            borderRadius: 4,
            border: "1px solid",
            ...(state.saved && state.status !== "invalid"
              ? {
                  color: "var(--accent)",
                  background: "var(--accent-dim)",
                  borderColor: "var(--accent-border)",
                }
              : {
                  color: "var(--text-muted)",
                  background: "rgba(255,255,255,0.03)",
                  borderColor: "var(--border)",
                }),
          }}
        >
          {state.saved && state.status !== "invalid" ? "Configured" : "Not Set"}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "20px" }}>
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 8,
          }}
        >
          API Key
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input
              type={showKey ? "text" : "password"}
              value={state.value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              style={{
                width: "100%",
                paddingRight: 40,
                fontFamily: state.value && !showKey ? "monospace" : "inherit",
                letterSpacing: state.value && !showKey ? "0.1em" : "normal",
              }}
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              title={showKey ? "Hide key" : "Show key"}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                fontSize: 13,
                padding: 2,
                lineHeight: 1,
              }}
            >
              {showKey ? "🙈" : "👁"}
            </button>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={!hasKey || state.validating}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              background: hasKey && !state.validating ? "var(--accent)" : "rgba(74,222,128,0.1)",
              color: hasKey && !state.validating ? "#050a05" : "var(--accent)",
              border: "none",
              cursor: hasKey && !state.validating ? "pointer" : "not-allowed",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "var(--font-dm-sans), sans-serif",
              whiteSpace: "nowrap",
              opacity: !hasKey ? 0.4 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {state.validating ? "Testing…" : "Save & Test"}
          </button>

          {state.saved && (
            <button
              type="button"
              onClick={clear}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                background: "transparent",
                border: "1px solid var(--border-strong)",
                color: "var(--danger)",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "var(--font-dm-sans), sans-serif",
                transition: "border-color 0.15s",
              }}
              title="Remove key"
            >
              Clear
            </button>
          )}
        </div>

        <StatusChip status={state.status} message={state.message} />

        <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
          Get your key at{" "}
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--text-secondary)", textDecoration: "underline" }}
          >
            {docsUrl.replace("https://", "")}
          </a>
        </p>
      </div>
    </div>
  );
}

/* ── Storage info box ── */
function StorageInfo() {
  const [keyCount, setKeyCount] = useState(0);

  useEffect(() => {
    let count = 0;
    if (localStorage.getItem("chess_arena_openrouter_key")) count++;
    if (localStorage.getItem("chess_arena_groq_key")) count++;
    setKeyCount(count);
  }, []);

  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 8,
        background: "rgba(255,255,255,0.025)",
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        fontSize: 13,
        color: "var(--text-secondary)",
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>🔒</span>
      <div>
        <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          Local storage only.
        </strong>{" "}
        Keys are stored in your browser&apos;s <code style={{ fontSize: 12, background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>localStorage</code> and sent directly
        to the AI provider on each move request. They are never persisted on
        our servers.{" "}
        {keyCount > 0 && (
          <span style={{ color: "var(--accent)" }}>
            {keyCount} key{keyCount > 1 ? "s" : ""} currently saved.
          </span>
        )}
      </div>
    </div>
  );
}

export function SettingsClient() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <StorageInfo />

      <ProviderCard
        title="OpenRouter"
        provider="openrouter"
        logo="🌐"
        docsUrl="https://openrouter.ai/keys"
        placeholder="sk-or-v1-…"
        description="Access 200+ LLMs from a single unified API"
      />

      <ProviderCard
        title="Groq"
        provider="groq"
        logo="⚡"
        docsUrl="https://console.groq.com/keys"
        placeholder="gsk_…"
        description="Ultra-fast inference for open-source models"
      />

      <div
        style={{
          padding: "16px 18px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          fontSize: 13.5,
          color: "var(--text-secondary)",
          lineHeight: 1.55,
        }}
      >
        <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
          How it works
        </p>
        <ul style={{ paddingLeft: 16, display: "grid", gap: 5 }}>
          <li>Your saved keys override the server-side environment variables.</li>
          <li>
            Groq models appear in the simulation model selector prefixed with{" "}
            <code style={{ fontSize: 12, background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>
              groq:
            </code>
            .
          </li>
          <li>Both providers can be used simultaneously in the same game.</li>
          <li>Clearing a key falls back to the server environment variable if one is set.</li>
        </ul>
      </div>
    </div>
  );
}
