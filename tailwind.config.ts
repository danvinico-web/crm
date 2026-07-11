import type { Config } from "tailwindcss";

/**
 * Токены берутся из CSS-переменных (см. globals.css), поэтому темы
 * (dark/light) переключаются одним атрибутом data-theme на <body>.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        border: "var(--border)",
        "border-soft": "var(--border-soft)",
        text: "var(--text)",
        "text-dim": "var(--text-dim)",
        "text-mute": "var(--text-mute)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",
        green: "var(--green)",
        amber: "var(--amber)",
        red: "var(--red)",
        purple: "var(--purple)",
        sidebar: "var(--sidebar)",
        "sidebar-2": "var(--sidebar-2)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
      },
      borderRadius: {
        card: "14px",
        sm: "10px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      maxWidth: {
        content: "1500px",
      },
    },
  },
  plugins: [],
};

export default config;
