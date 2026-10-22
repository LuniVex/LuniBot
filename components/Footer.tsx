import Link from "next/link";
import { site } from "@/lib/bots";

export function Footer() {
  return (
    <footer className="bg-alt">
      <div className="t-tiny mx-auto max-w-page px-5 py-10 text-fg-3">
        <p className="border-b border-line pb-4">
          Every bot is downloaded and run on your own machine. Downloads and upvotes are counted anonymously; see{" "}
          <Link href="/about#counting" className="link">what the site counts</Link>. Not affiliated with Discord or OpenAI.
        </p>
        <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p>Copyright © {new Date().getFullYear()} {site.owner}.</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            <li><Link href="/" className="hover:text-fg">Bots</Link></li>
            <li><Link href="/about" className="hover:text-fg">About</Link></li>
            <li><a href={site.discord} target="_blank" rel="noopener noreferrer" className="hover:text-fg">Discord</a></li>
            <li><a href={`https://github.com/${site.githubOwner}`} target="_blank" rel="noopener noreferrer" className="hover:text-fg">GitHub</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
