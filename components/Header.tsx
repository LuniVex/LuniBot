"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { site } from "@/lib/bots";
import { Container } from "./Container";
import { ThemeToggle } from "./ThemeToggle";

const links = [{ href: "/", label: "Bots" }, { href: "/about", label: "About" }];

export function Header() {
  const path = usePathname();
  const isActive = (href: string) => (href === "/" ? path === "/" || path.startsWith("/bots") : path.startsWith(href));
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper">
      <Container className="flex items-baseline justify-between py-4">
        <Link href="/" className="text-xl font-bold no-underline">{site.name}</Link>
        <nav aria-label="Main" className="flex items-baseline gap-6">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className="relative text-sm no-underline">
              {l.label}
              {isActive(l.href) && <motion.span layoutId="nav-active" className="absolute -bottom-1 left-0 h-0.5 w-full bg-accent" />}
            </Link>
          ))}
          <a href={`https://github.com/${site.githubOwner}`} target="_blank" rel="noopener noreferrer" className="text-sm no-underline">GitHub</a>
          <ThemeToggle />
        </nav>
      </Container>
    </header>
  );
}
