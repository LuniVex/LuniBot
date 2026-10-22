import { More, Pill } from "./Button";
import { Enter } from "./Motion";

/** Headline, one plain sentence, the two actions, then the actual commands that start any bot. */
export function Hero({ zip }: { zip: string }) {
  const lines = [`unzip ${zip}`, "cp .env.example .env    # then paste your bot token into .env", "npm ci && npm start"];
  return (
    <section className="px-5 pb-24 pt-33 text-center md:pt-41">
      <Enter><h1 className="t-hero mx-auto max-w-[14ch]">Discord bots you run yourself.</h1></Enter>
      <Enter delay={0.08}>
        <p className="t-lead mx-auto mt-5 max-w-[36ch] text-fg-2">
          Download a bot, add your bot token, and start it on your own computer or server. It&apos;s free and you don&apos;t need an account.
        </p>
      </Enter>
      <Enter delay={0.16} className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <Pill href="#bots" size="lg">Browse bots</Pill>
        <More href="/about#checking" className="text-[17px]">How downloads are checked</More>
      </Enter>

      <Enter delay={0.24} className="mx-auto mt-16 max-w-[720px] md:mt-20">
        <div className="overflow-hidden rounded-[12px] border border-line text-left shadow-[0_30px_80px_-40px_rgba(0,0,0,0.5)]">
          <div className="relative flex h-9 items-center border-b border-line bg-alt px-4">
            <span className="flex gap-2" aria-hidden="true">
              <i className="size-3 rounded-full bg-[#ff5f57]" /><i className="size-3 rounded-full bg-[#febc2e]" /><i className="size-3 rounded-full bg-[#28c840]" />
            </span>
            <span className="t-tiny absolute inset-x-0 text-center text-fg-3">Terminal</span>
          </div>
          <div className="bg-bg px-5 py-5 font-mono text-[13px] leading-7 md:px-6 md:text-[14px] dark:bg-tile">
            {lines.map((l) => {
              const [cmd, note] = l.split("    # ");
              return (
                <p key={l} className="break-words">
                  <span className="select-none text-fg-3">$ </span>{cmd}
                  {note && <span className="text-fg-3 max-sm:block max-sm:pl-4">{"  "}# {note}</span>}
                </p>
              );
            })}
          </div>
        </div>
        <p className="t-small mt-4 text-fg-3">The same three steps work for every bot. Each bot&apos;s page lists what else it needs.</p>
      </Enter>
    </section>
  );
}
