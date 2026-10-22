import Link from "next/link";
import { site } from "@/lib/bots";
import { Container } from "./Container";

export function Footer() {
  return (
    <footer className="border-t border-rule py-12">
      <Container className="grid gap-x-6 gap-y-6 text-sm md:grid-cols-12">
        <p className="font-display text-xl font-semibold md:col-span-3">{site.name}</p>
        <div className="md:col-span-5">
          <p className="max-w-measure">Written and maintained by {site.owner}. No accounts. Downloads and upvotes are counted anonymously.</p>
          <p className="mt-2 text-muted">Not affiliated with Discord or OpenAI.</p>
        </div>
        <ul className="flex flex-col gap-1 md:col-span-4">
          <li><Link href="/about">About, safety and licensing</Link></li>
          <li><a href={site.discord} target="_blank" rel="noopener noreferrer">Discord</a></li>
          <li><a href={`https://github.com/${site.githubOwner}`} target="_blank" rel="noopener noreferrer">GitHub</a></li>
          <li className="mt-2 text-muted tabular-nums">© {new Date().getFullYear()} {site.owner}</li>
        </ul>
      </Container>
    </footer>
  );
}
