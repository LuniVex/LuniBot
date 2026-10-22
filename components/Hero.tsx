"use client";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { fadeUp } from "@/lib/motion";
import { More, Pill } from "./Button";
import { Glow, Words } from "./Motion";

const CHAR_MS = 24;     // typing speed
const LINE_PAUSE = 360; // pause after each command, as if it ran

/** Types the commands out one character at a time, then leaves a blinking cursor. */
function useTyping(lines: string[], startAfter: number, instant: boolean) {
  const total = lines.join("").length;
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    if (instant) return;
    let n = 0, timer: ReturnType<typeof setTimeout>;
    const ends = lines.map((_, i) => lines.slice(0, i + 1).join("").length);
    const tick = () => {
      n += 1;
      setTyped(n);
      if (n < total) timer = setTimeout(tick, ends.includes(n) ? LINE_PAUSE : CHAR_MS + Math.random() * 22);
    };
    timer = setTimeout(tick, startAfter);
    return () => clearTimeout(timer);
  }, [lines, total, startAfter, instant]);
  const count = instant ? total : typed;
  return lines.map((l, i) => {
    const start = lines.slice(0, i).join("").length;
    return l.slice(0, Math.max(0, count - start));
  });
}

/**
 * Centered headline, then a terminal window that types the three real commands that start any bot.
 * As the page scrolls, the window tilts up and settles into place, smoothed by a spring.
 */
export function Hero({ zip }: { zip: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // The first render must match the server's, so the reduced-motion choice only applies after hydration.
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const reduce = useReducedMotion() && hydrated;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const p = useSpring(scrollYProgress, { stiffness: 80, damping: 22, mass: 0.6 });
  const scale = useTransform(p, [0, 1], [0.86, 1]);
  const rotateX = useTransform(p, [0, 1], [16, 0]);
  const y = useTransform(p, [0, 1], [60, 0]);

  const [lines] = useState(() => [`unzip ${zip}`, "cp .env.example .env", "npm ci && npm start"]);
  const typed = useTyping(lines, 1100, !!reduce);
  const current = typed.findIndex((t, i) => t.length < lines[i].length);
  const caretLine = current === -1 ? lines.length : current;

  return (
    <section className="relative overflow-hidden px-5 pb-28 pt-33 text-center md:pt-41">
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-alt/70 via-bg to-bg" />
      <Glow colors={["#2f8cff", "#ff5a6e"]} />

      <div className="relative">
        <motion.p className="t-eyebrow text-fg-2" initial={{ opacity: 0, y: 12, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={fadeUp(0)}>
          LuniBots
        </motion.p>
        <Words text="Discord bots you run yourself." className="t-hero mx-auto mt-3 max-w-[14ch]" delay={0.1} />
        <motion.p className="t-lead mx-auto mt-5 max-w-[34ch] text-fg-2" initial={{ opacity: 0, y: 20, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={fadeUp(0.45)}>
          Free to download. No account. They run on your machine, in your server.
        </motion.p>
        <motion.div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={fadeUp(0.6)}>
          <Pill href="#bots" size="lg">Browse the bots</Pill>
          <More href="#how" className="text-[17px]">How it works</More>
        </motion.div>

        <div ref={ref} className="mx-auto mt-16 max-w-[760px] [perspective:1400px] md:mt-20">
          <motion.div style={reduce ? undefined : { scale, rotateX, y }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2, ease: [0.28, 0.11, 0.32, 1], delay: 0.7 }}
            className="origin-bottom overflow-hidden rounded-[14px] border border-line/70 bg-bg/90 text-left shadow-[0_50px_120px_-40px_rgba(0,0,0,0.4)] ring-1 ring-black/[0.02] dark:bg-tile/90 dark:ring-white/[0.06]">
            <div className="relative flex h-10 items-center border-b border-line/60 bg-alt/80 px-4">
              <span className="flex gap-2" aria-hidden="true">
                <i className="size-3 rounded-full bg-[#ff5f57]" /><i className="size-3 rounded-full bg-[#febc2e]" /><i className="size-3 rounded-full bg-[#28c840]" />
              </span>
              <span className="t-tiny absolute inset-x-0 text-center text-fg-3"><span className="sm:hidden">Terminal</span><span className="max-sm:hidden">Terminal: three commands to run any bot</span></span>
            </div>
            {/* All four rows (three commands and the prompt) always take their space, so typing never moves the page below. */}
            <div className="px-5 py-6 font-mono text-[14px] leading-7 md:px-8 md:text-[15px]" aria-label={lines.join(", then ")}>
              {[...lines, ""].map((l, i) => (
                <p key={i} aria-hidden="true" className={`min-h-7 break-all ${i <= caretLine ? "" : "invisible"}`}>
                  <span className="select-none text-fg-3">~ % </span>{typed[i] ?? ""}
                  {i === caretLine && <span className="caret ml-px inline-block h-[1.1em] w-[0.55em] translate-y-[0.2em] bg-fg" />}
                </p>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
