"use client";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { ease } from "@/lib/motion";

/** Rolls up to its value once visible, and glides between values when it changes. */
export function Count({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0); // same starting text on server and client; reduced motion jumps straight to the value
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString("en-GB"));

  useEffect(() => {
    if (reduce) { mv.set(value); return; }
    if (!seen) return;
    const distance = Math.abs(value - mv.get());
    const c = animate(mv, value, { duration: distance <= 1 ? 0.5 : Math.min(1.6, 0.8 + Math.log10(distance + 1) * 0.35), ease });
    return () => c.stop();
  }, [value, seen, reduce, mv]);

  return <motion.span ref={ref} className="tabular-nums">{text}</motion.span>;
}
