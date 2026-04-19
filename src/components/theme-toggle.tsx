"use client";

const THEME_STORAGE_KEY = "chess-arena-theme";

type Theme = "light" | "dark";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getInitialTheme(): Theme {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }
  return getSystemTheme();
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

function getCurrentTheme(): Theme {
  const currentTheme = document.documentElement.dataset.theme;
  if (currentTheme === "light" || currentTheme === "dark") {
    return currentTheme;
  }
  return getInitialTheme();
}

export function ThemeToggle() {
  const onToggle = () => {
    const nextTheme = getCurrentTheme() === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label="Toggle color theme"
      title="Toggle color theme"
      style={{
        padding: "6px 10px",
        borderRadius: 6,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: "var(--text-secondary)",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        cursor: "pointer",
        transition: "color 0.15s, border-color 0.15s",
      }}
    >
      Theme
    </button>
  );
}