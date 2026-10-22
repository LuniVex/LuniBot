"use client";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { site } from "@/lib/bots";
import { glide } from "@/lib/motion";
import { ThemeToggle } from "./Theme";

const nav = [{ href: "/", label: "Bots" }, { href: "/about", label: "About" }];

/** Frosted, translucent bar that stays at the top. It is clear at the top of the page and frosts over once you scroll. */
export function Header() {
  const path = usePathname();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 8));
  const current = (href: string) => (href === "/" ? path === "/" || path.startsWith("/bots") : path.startsWith(href));
  return (
    <header className={`smooth sticky top-0 z-50 border-b backdrop-blur-xl backdrop-saturate-150 ${scrolled ? "border-line/60 bg-glass" : "border-transparent bg-bg/0"} -mb-13`}>
      <div className="mx-auto flex h-13 max-w-page items-center justify-between px-5">
        <Link href="/" className="text-[19px] font-semibold tracking-[-0.02em]">{site.name}</Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          {nav.map((l) => (
            <Link key={l.href} href={l.href} aria-current={current(l.href) ? "page" : undefined}
              className="smooth relative rounded-full px-3 py-1.5 text-[13px] text-fg-2 hover:text-fg aria-[current=page]:text-fg">
              {current(l.href) && <motion.span layoutId="nav-pill" transition={glide} className="absolute inset-0 rounded-full bg-tile" />}
              <span className="relative">{l.label}</span>
            </Link>
          ))}
          <a href={`https://github.com/${site.githubOwner}`} target="_blank" rel="noopener noreferrer" aria-label={`${site.githubOwner} on GitHub`}
            className="smooth ml-1 grid size-9 place-items-center rounded-full text-fg-2 hover:bg-tile hover:text-fg">
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-[17px] fill-current">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
