import Link from "next/link";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { bots } from "@/lib/bots";

export default function NotFound() {
  return (
    <Container className="grid gap-x-6 gap-y-8 py-16 md:grid-cols-12">
      <p className="font-mono text-sm text-muted md:col-span-3">404</p>
      <div className="md:col-span-9">
        <h1 className="max-w-title font-display text-4xl font-normal md:text-5xl">There is no page at this address.</h1>
        <p className="mt-4 max-w-measure text-xl">The link may be old, or the bot may have been renamed. These are the bots that exist:</p>
        <ul className="mt-6 max-w-measure">
          {bots.map((b) => <li key={b.slug} className="border-t border-rule py-2 last:border-b"><Link href={`/bots/${b.slug}`}>{b.name}</Link> <span className="text-muted">{b.tagline}</span></li>)}
        </ul>
        <div className="mt-8"><Button href="/">Back to all bots</Button></div>
      </div>
    </Container>
  );
}
