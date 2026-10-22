import { Button } from "./Button";
import { Container } from "./Container";
import { Item, Stagger } from "./Motion";

/**
 * Headline block (L6, L10): a large title across nine columns, then an uneven row of
 * facts (3 cols), the pitch (5 cols) and the real run steps (4 cols).
 */
export function Hero({ count, runtimes, zip }: { count: number; runtimes: string; zip: string }) {
  const steps = [`unzip ${zip}`, "cp .env.example .env", "npm ci && npm start"];
  return (
    <section className="border-b border-rule pb-12 pt-12 md:pb-16 md:pt-16">
      <Container>
        <Stagger gap={0.08}>
          <Item>
            <h1 className="max-w-title font-display text-4xl font-normal md:text-6xl">Discord bots you run yourself.</h1>
          </Item>
          <div className="mt-12 grid gap-x-6 gap-y-8 md:grid-cols-12">
            <Item className="md:col-span-3">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
                <dt className="text-muted">Bots</dt><dd className="tabular-nums">{count}</dd>
                <dt className="text-muted">Runs on</dt><dd>{runtimes}</dd>
                <dt className="text-muted">Price</dt><dd>Free</dd>
                <dt className="text-muted">Account</dt><dd>None</dd>
              </dl>
            </Item>
            <Item className="md:col-span-5">
              <p className="max-w-measure text-xl">Each bot is a Node.js program. Download the code from this page, run it on your own machine, and invite it to your own server. Nothing here runs on our servers for you.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button href="#bots">Browse the bots</Button>
                <Button href="/about#checking" variant="outline">How to check a download</Button>
              </div>
            </Item>
            <Item className="md:col-span-4">
              <figure>
                <div className="border border-ink p-4 font-mono text-sm">
                  {steps.map((l) => <p key={l} className="break-all"><span aria-hidden="true" className="select-none text-muted">$ </span>{l}</p>)}
                </div>
                <figcaption className="mt-2 text-sm text-muted">Fig. 1. Running any bot takes these three commands.</figcaption>
              </figure>
            </Item>
          </div>
        </Stagger>
      </Container>
    </section>
  );
}
