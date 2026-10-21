import type { Transition, Variants } from "framer-motion";

/** One spring for everything, so motion feels like a single system. Transform and opacity only. */
export const spring: Transition = { type: "spring", stiffness: 300, damping: 32, mass: 0.8 };

export const stagger = (gap = 0.06): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap } },
});

export const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring },
};
