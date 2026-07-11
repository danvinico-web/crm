"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "leadhub-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const current = (document.body.getAttribute("data-theme") as "dark" | "light") || "dark";
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.body.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  return (
    <button className="icon-btn" onClick={toggle} title="Переключить тему" aria-label="Переключить тему">
      {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
