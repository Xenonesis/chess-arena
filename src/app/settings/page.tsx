import { SettingsClient } from "@/components/settings-client";

export default function SettingsPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px 80px",
        width: "100%",
      }}
    >
      <header className="animate-enter" style={{ marginBottom: 40 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.13em",
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: 10,
          }}
        >
          Configuration
        </p>
        <h1
          style={{
            fontFamily: "var(--font-playfair), Georgia, serif",
            fontSize: "clamp(26px, 3.5vw, 38px)",
            fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "-0.02em",
            marginBottom: 10,
          }}
        >
          Settings
        </h1>
        <p style={{ fontSize: 14.5, color: "var(--text-secondary)", maxWidth: 500 }}>
          API keys are stored locally in your browser and never sent to our
          servers — they go directly to the AI provider per request. You can
          configure separate keys for White and Black players.
        </p>
      </header>

      <div className="animate-enter-delay-1">
        <SettingsClient />
      </div>
    </main>
  );
}
