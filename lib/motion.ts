import type { Transition, Variants } from "framer-motion";

/**
 * Motion system (skills/motion.md). One ease, short durations, transform and opacity only.
 * Mirrored in tokens.css (--ease, --dur-fast) for CSS transitions.
 */
export const ease = [0.22, 1, 0.36, 1] as const;
export const dur = { fast: 0.16, base: 0.32, layout: 0.4 } as const;

export const tFast: Transition = { duration: dur.fast, ease };
export const tBase: Transition = { duration: dur.base, ease };
export const tLayout: Transition = { duration: dur.layout, ease };

export const stagger = (gap = 0.06): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap } },
});

export const rise: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: tBase },
};
