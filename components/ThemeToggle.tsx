"use client";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <NextThemes attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>{children}</NextThemes>;
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // false during server render and hydration, true afterwards: avoids a theme-label mismatch.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button type="button" onClick={() => setTheme(dark ? "light" : "dark")} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="text-sm text-muted underline hover:text-accent">
      {dark ? "Light" : "Dark"}
    </button>
  );
}
