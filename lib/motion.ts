import type { Transition, Variants } from "framer-motion";

/**
 * One motion language for the whole site: long, soft eases for fades and reveals,
 * smooth springs (no overshoot) for anything that moves in response to the user.
 */
export const ease = [0.28, 0.11, 0.32, 1] as const;
export const easeCss = `cubic-bezier(${ease.join(", ")})`;

/** Reveals, layout moves and shared highlights. */
export const glide: Transition = { type: "spring", stiffness: 140, damping: 26, mass: 1 };
/** Hover and press feedback. */
export const touch: Transition = { type: "spring", stiffness: 320, damping: 32, mass: 0.9 };

export const fadeUp = (delay = 0): Transition => ({ opacity: { duration: 0.7, ease, delay }, y: { ...glide, delay }, scale: { ...glide, delay } });

export const stagger = (gap = 0.08, delay = 0): Variants => ({ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } });

export const rise: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: fadeUp() },
};
