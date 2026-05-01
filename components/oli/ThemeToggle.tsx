"use client";

import { useEffect, useState } from "react";

/**
 * Light-default theme toggle for the OLI shell. Mirrors the Commit Mono
 * specimen's `M  Light/dark` keymap entry — the M key on the page toggles
 * `.oli-dark` on the shell wrapper. Theme persists in localStorage so a
 * reload retains the user's choice.
 *
 * Important: light is the default. We do NOT read prefers-color-scheme — the
 * site root is forced dark (see `<html className="dark">` in app/layout.tsx),
 * so respecting the OS preference here would always boot OLI dark and miss
 * the design intent. Users who want dark click M; first-load is always paper.
 *
 * The button is rendered as a tiny inline keycap so the toggle reads as part
 * of the keymap legend itself, not as a separate widget.
 */

const STORAGE_KEY = "oli-theme";

function applyTheme(dark: boolean) {
  const shell = document.querySelector(".oli-shell");
  if (!shell) return;
  shell.classList.toggle("oli-dark", dark);
}

function readStoredTheme(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "dark";
  } catch {
    return false;
  }
}

function writeStoredTheme(dark: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    /* noop */
  }
}

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(false);

  // On mount, hydrate from storage and apply to the shell. URL param
  // `?theme=dark|light` overrides storage so the headless screenshot script
  // can capture both modes from a clean Chrome with no persisted state.
  useEffect(() => {
    let initial = readStoredTheme();
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("theme");
      if (q === "dark") initial = true;
      if (q === "light") initial = false;
    } catch {
      /* noop */
    }
    setDark(initial);
    applyTheme(initial);
  }, []);

  // M key — toggle dark/light. Skip if focus is in an input/textarea so we
  // don't intercept letters in form fields. Skip if a modifier is held so
  // ⌘M (minimize) and Alt-M still pass through.
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const tag = (ev.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((ev.target as HTMLElement | null)?.isContentEditable) return;
      if (ev.key === "m" || ev.key === "M") {
        ev.preventDefault();
        setDark((prev) => {
          const next = !prev;
          applyTheme(next);
          writeStoredTheme(next);
          return next;
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggle() {
    setDark((prev) => {
      const next = !prev;
      applyTheme(next);
      writeStoredTheme(next);
      return next;
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light/dark"
      title="Toggle light/dark (M)"
      className="oli-keycap oli-theme-toggle"
      style={{ cursor: "pointer" }}
    >
      M
    </button>
  );
}
