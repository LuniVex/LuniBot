# Anti-patterns (banned)

If any of these appears, the work is wrong. Remove it.

- **A1 Glossy / gradient buttons.** Buttons are flat: solid fill or 1px outline.
- **A2 Heavy drop shadows** and glows. No `box-shadow` at all unless a reference justifies it in writing.
- **A3 Large uniform border-radius on everything.** Max radius 2px; most things 0.
- **A4 Glassmorphism:** blur, translucent panels, `backdrop-filter`.
- **A5 Purple-to-blue (or any) hero gradients.** No gradients without a cited reference.
- **A6 Centered-everything layouts.** See L3, T6.
- **A7 The generic "hero image + three feature cards + CTA" structure.**
- **A8 Emoji as icons.** Use text, or a tiny set of drawn SVG icons only where function requires one.
- **A9 Pitch-deck copy:** "Empower your workflow", "Supercharge", "seamless", "unlock", "revolutionary", "next-generation". Write what the thing does.
- **A10 Decorative filler:** grid-paper backgrounds, floating blobs, animated glows, scroll-reveal on everything, pill badges that restate the heading.
- **A11 Colour as the only hierarchy** or status signal (D4, D5).
- **A12 Fake social proof, fake stats, fake testimonials.**
- **A13 Card-for-everything.** Not every item needs a bordered rounded box (L4, L5).
- **A14 Perfect symmetry and even spacing everywhere.** Every page needs one focal point and deliberate unevenness: an oversized item beside smaller ones, a wide column beside a narrow one (L3, L11).
- **A15 Uniform 3-up card grids.** Cards of equal size in equal columns read as a template. Vary span and scale (L11).
- **A16 Lift-and-glow hover.** Hover changes border or background, plus at most a 2px nudge or a 1.01 scale. No shadow, no glow (A2).
- **A17 Stock imagery and decorative illustration.** Show real data or nothing (D8).
- **A18 Bouncy default springs.** Motion uses one short custom ease, transform and opacity only, and respects `prefers-reduced-motion` (M1, M2).
