"use client";
import { motion, useReducedMotion } from "framer-motion";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { easeCss } from "@/lib/motion";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <NextThemes attribute="class" defaultTheme="dark" enableSystem={false} storageKey="lunibots-theme" disableTransitionOnChange>{children}</NextThemes>;
}

type StartViewTransition = (update: () => void) => { ready: Promise<void> };

/** Light/dark switch. The new theme spreads out from the button as a growing circle; the icon turns as it changes. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const reduce = useReducedMotion();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    const next = dark ? "light" : "dark";
    const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition?.bind(document);
    if (reduce || !start) { setTheme(next); return; }
    const box = e.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2, y = box.top + box.height / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    start(() => {
      document.documentElement.classList.toggle("dark", next === "dark");
      flushSync(() => setTheme(next));
    }).ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 900, easing: easeCss, pseudoElement: "::view-transition-new(root)" },
      );
    }).catch(() => {});
  }

  return (
    <button type="button" onClick={toggle} aria-label={dark ? "Switch to light appearance" : "Switch to dark appearance"}
      className="smooth grid size-9 place-items-center rounded-full text-fg-2 hover:bg-tile hover:text-fg">
      <motion.svg viewBox="0 0 16 16" aria-hidden="true" className="size-[17px]" initial={false}
        animate={{ rotate: dark ? 180 : 0 }} transition={{ type: "spring", stiffness: 80, damping: 18 }}>
        <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 1.6a6.4 6.4 0 0 1 0 12.8z" fill="currentColor" />
      </motion.svg>
    </button>
  );
}
