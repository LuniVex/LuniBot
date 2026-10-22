"use client";
import { MotionConfig, motion } from "framer-motion";
import { fadeUp, rise, stagger } from "@/lib/motion";

/** Reduced-motion preferences are respected site-wide: movement is dropped, fades remain. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Fades and floats up into place the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0, as = "div" }: { children: React.ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" }) {
  const Tag = motion[as];
  return (
    <Tag className={className} initial={{ opacity: 0, y: 28, filter: "blur(6px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }} transition={fadeUp(delay)}>
      {children}
    </Tag>
  );
}

/** Children reveal one after another, once. Use RevealChild inside. */
export function RevealGroup({ children, className, gap = 0.08 }: { children: React.ReactNode; className?: string; gap?: number }) {
  return (
    <motion.div className={className} variants={stagger(gap)} initial="hidden" whileInView="show" viewport={{ once: true, margin: "0px 0px -80px 0px" }}>
      {children}
    </motion.div>
  );
}

export function RevealChild({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.div className={className} variants={rise}>{children}</motion.div>;
}

/** Same rise as Reveal, but on mount: for content that is already on screen when the page opens. */
export function Enter({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 24, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={fadeUp(delay)}>
      {children}
    </motion.div>
  );
}

/** Soft breathing placeholder while numbers load. */
export function Shimmer({ className = "" }: { className?: string }) {
  return (
    <motion.div aria-hidden="true" className={`rounded-lg bg-line/50 ${className}`}
      animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
  );
}

/** A headline that resolves word by word: each word rises and comes into focus a beat after the last. */
export function Words({ text, className, delay = 0, as = "h1" }: { text: string; className?: string; delay?: number; as?: "h1" | "h2" }) {
  const Tag = motion[as];
  return (
    <Tag className={className} aria-label={text} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: delay } } }}>
      {text.split(" ").map((w, i) => (
        <motion.span key={i} aria-hidden="true" className="inline-block whitespace-pre"
          variants={{ hidden: { opacity: 0, y: "0.35em", filter: "blur(10px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: fadeUp() } }}>
          {w}{i < text.split(" ").length - 1 ? " " : ""}
        </motion.span>
      ))}
    </Tag>
  );
}

/**
 * Soft colour light that drifts slowly behind a section. The layer fades to nothing at its top and
 * bottom (a mask), so it never shows an edge. Purely decorative; it holds still with reduced motion.
 */
export function Glow({ colors, strength = 1, className = "" }: { colors: [string, string]; strength?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ maskImage: "linear-gradient(to bottom, transparent 0%, black 30%, black 62%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 30%, black 62%, transparent 100%)" }}>
      <motion.div className="absolute left-1/2 top-[55%] size-[42rem] rounded-full blur-[120px] opacity-[var(--glow-a)] dark:opacity-[var(--glow-a-dark)]"
        style={{ background: colors[0], translateX: "-80%", translateY: "-50%", ["--glow-a" as string]: 0.2 * strength, ["--glow-a-dark" as string]: 0.13 * strength }}
        animate={{ x: [0, 50, -20, 0], y: [0, -30, 24, 0] }} transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="absolute left-1/2 top-[60%] size-[38rem] rounded-full blur-[120px] opacity-[var(--glow-b)] dark:opacity-[var(--glow-b-dark)]"
        style={{ background: colors[1], translateX: "-20%", translateY: "-50%", ["--glow-b" as string]: 0.16 * strength, ["--glow-b-dark" as string]: 0.11 * strength }}
        animate={{ x: [0, -40, 26, 0], y: [0, 24, -30, 0] }} transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }} />
    </div>
  );
}
