import { site } from "@/lib/bots";
import { More, Pill } from "./Button";
import { Count } from "./Count";
import { Reveal, RevealChild, RevealGroup } from "./Motion";

/** Big, simple facts on a light grey band. */
export function Facts({ count, runtime }: { count: number; runtime: string }) {
  const facts: [React.ReactNode, string][] = [
    [<Count key="n" value={count} />, count === 1 ? "bot to download" : "bots to download"],
    ["Free", "No price, no subscription"],
    [<Count key="a" value={0} />, "Accounts needed"],
    [runtime.replace("Node.js ", ""), "Node.js version to run them"],
  ];
  return (
    <section className="bg-alt px-5 py-24 md:py-32">
      <div className="mx-auto max-w-page text-center">
        <Reveal><h2 className="t-section">Yours to run.</h2></Reveal>
        <Reveal delay={0.08}><p className="t-lead mx-auto mt-4 max-w-[38ch] text-fg-2">Every bot ships as source code you host yourself. Nothing runs on our servers, so there&apos;s nothing to sign up for.</p></Reveal>
        <RevealGroup className="mt-16 grid grid-cols-2 gap-y-12 md:grid-cols-4">
          {facts.map(([value, label]) => (
            <RevealChild key={label}>
              <p className="text-[clamp(2.5rem,4vw,3.5rem)] font-semibold leading-none tracking-[-0.02em]">{value}</p>
              <p className="t-small mt-3 text-fg-2">{label}</p>
            </RevealChild>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

/** The three real steps from zip to running bot. */
export function HowItWorks({ zip }: { zip: string }) {
  const steps = [
    { title: "Download", text: "Pick a bot and download its zip. It's the source code, nothing else.", code: `unzip ${zip}` },
    { title: "Add your token", text: "Create a bot in the Discord developer portal and paste its token into .env.", code: "cp .env.example .env" },
    { title: "Start it", text: "Install the dependencies and start the bot. Then invite it to your server.", code: "npm ci && npm start" },
  ];
  return (
    <section id="how" className="scroll-mt-14 px-5 py-24 md:py-32">
      <div className="mx-auto max-w-page">
        <Reveal className="text-center"><h2 className="t-section">How it works.</h2></Reveal>
        <RevealGroup className="mt-14 grid gap-5 md:grid-cols-3 [&>*]:h-full">
          {steps.map((s, i) => (
            <RevealChild key={s.title} className="group">
              <div className="flex h-full flex-col rounded-tile bg-tile p-8 ring-1 ring-transparent transition-[translate,box-shadow] duration-500 ease-[cubic-bezier(0.28,0.11,0.32,1)] group-hover:-translate-y-1 group-hover:shadow-[0_24px_60px_-30px_rgba(0,0,0,0.3)] dark:ring-white/[0.06]">
              <span className="grid size-9 place-items-center rounded-full bg-fg text-[15px] font-semibold text-bg">{i + 1}</span>
              <h3 className="mt-6 text-[24px] font-semibold leading-tight">{s.title}</h3>
              <p className="mt-2 text-fg-2">{s.text}</p>
              <p className="mt-auto pt-6 font-mono text-[13px] text-fg-2"><span className="select-none text-fg-3">~ % </span>{s.code}</p>
              </div>
            </RevealChild>
          ))}
        </RevealGroup>
        <Reveal className="mt-10 text-center"><More href="/about#checking">How to check a download is genuine</More></Reveal>
      </div>
    </section>
  );
}

/** "Want features added?" call to action, on the hub and every bot page. */
export function DiscordCta() {
  return (
    <section className="px-5 pb-24 md:pb-32">
      <Reveal className="relative isolate mx-auto max-w-page overflow-hidden rounded-tile bg-[#1d1d1f] px-8 py-20 text-center text-[#f5f5f7] ring-1 ring-white/[0.06] md:py-24">
        <span aria-hidden="true" className="absolute left-1/2 top-0 -z-10 h-64 w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5865f2] opacity-45 blur-[90px]" />
        <h2 className="t-section">Want features added?</h2>
        <p className="t-lead mx-auto mt-4 max-w-[36ch] opacity-70">Tell us what to build next, report a bug, or get help setting a bot up.</p>
        <Pill href={site.discord} external size="lg" className="mt-8">Join the Discord</Pill>
      </Reveal>
    </section>
  );
}
