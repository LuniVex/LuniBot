"use client";
import { MotionConfig, motion } from "framer-motion";
import { rise, spring, stagger } from "@/lib/motion";

/** Respects prefers-reduced-motion: transforms are dropped, opacity changes stay. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={spring}>{children}</MotionConfig>;
}

/** Fades and lifts children in one after another when scrolled into view. */
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

/** A hairline that draws itself from the left. */
export function DrawRule({ className = "" }: { className?: string }) {
  return (
    <motion.div aria-hidden="true" className={`h-px origin-left bg-rule ${className}`}
      initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ ...spring, duration: 0.6 }} />
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <motion.div aria-hidden="true" className={`bg-rule ${className}`}
      animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} />
  );
}
