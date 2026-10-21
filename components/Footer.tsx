import Link from "next/link";
import { site } from "@/lib/bots";
import { Container } from "./Container";

export function Footer() {
  return (
    <footer className="border-t border-rule py-8">
      <Container className="flex flex-col gap-2 text-sm text-muted md:flex-row md:justify-between">
        <p>© {new Date().getFullYear()} {site.owner}. Not affiliated with Discord or OpenAI.</p>
        <p>No accounts, no analytics. <Link href="/about">About, safety and licensing</Link>.</p>
      </Container>
    </footer>
  );
}
