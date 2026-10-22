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
    <Tag className={className} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
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
    <motion.div className={className} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={fadeUp(delay)}>
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
