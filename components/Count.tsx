"use client";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect } from "react";
import { ease } from "@/lib/motion";

/**
 * Rolls a number from its previous value to the new one (M2: only the text node changes, tabular figures keep width stable).
 * Starts from 0 on first mount, which is after the data arrives, so the roll-up shows the real figure arriving.
 * With reduced motion the value is set instantly (M4).
 */
export function Count({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString("en-US"));

  useEffect(() => {
    if (reduce) { mv.set(value); return; }
    const delta = Math.abs(value - mv.get());
    const controls = animate(mv, value, { duration: delta <= 1 ? 0.2 : Math.min(0.9, 0.3 + Math.log10(delta + 1) * 0.25), ease });
    return () => controls.stop();
  }, [value, reduce, mv]);

  return <motion.span className={`tabular-nums ${className ?? ""}`}>{text}</motion.span>;
}
