"use client";
import { MotionConfig, motion } from "framer-motion";
import { rise, stagger, tBase } from "@/lib/motion";

/** Respects prefers-reduced-motion: transforms are dropped, opacity changes stay (M4). */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={tBase}>{children}</MotionConfig>;
}

/** Fades and lifts children in one after another, once, when scrolled into view (M3). */
export function Stagger({ children, className, gap }: { children: React.ReactNode; className?: string; gap?: number }) {
  return (
    <motion.div className={className} variants={stagger(gap)} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-48px" }}>
      {children}
    </motion.div>
  );
}

export function Item({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.div className={className} variants={rise}>{children}</motion.div>;
}

/** Loading placeholder: a ruled bar that breathes slowly. Never a spinner. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <motion.div aria-hidden="true" className={`bg-rule ${className}`}
      animate={{ opacity: [0.35, 0.75, 0.35] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
  );
}
