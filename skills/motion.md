# Motion

Framer Motion. A few good interactions beat many average ones.

- **M1 One ease, short durations.** Custom cubic-bezier `0.22, 1, 0.36, 1` (`ease`), 160ms for hovers, 320ms for entrances, 400ms for layout moves. No bouncy springs.
- **M2 Transform and opacity only.** No animating width, height, top, left, box-shadow or colour-heavy filters. Layout moves use FLIP (`layout`).
- **M3 Reveal once.** Scroll reveals fire once per element and never again. Filtering never replays them.
- **M4 Reduced motion.** `MotionConfig reducedMotion="user"`; roll-ups and reveals fall back to opacity or an instant value.
- **M5 Nothing stuck.** Items that leave and re-enter (filtering) must always end visible: no `whileInView` on items that remount.
- **M6 Hover is small and fast.** Border or background change plus a 2px arrow nudge. No lift, no glow (A16).
