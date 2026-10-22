# Design changelog, 2026-10-22

Presentation, layout and motion only. `data/bots.json`, `lib/bots.ts`, the API routes and all URLs are unchanged. Rule IDs refer to `skills/*.md`; numbers refer to `references/references.md`.

## Rules and references
- `skills/anti-patterns.md`: added A14 to A18 (symmetry, uniform 3-up grids, lift-and-glow, stock imagery, bouncy springs). Why: your Step 1 list.
- `skills/motion.md` (new): M1 to M6. Why: Step 5.
- `skills/typography.md`: T1 now allows a display face (Fraunces) next to the text face (Inter) and mono; T2 adds 49 and 61px display steps; T5 line-height 1.1 at those steps. These are deliberate amendments to match your brief (display + body pairing, big titles).
- `skills/layout.md`: L10 (lead with a focal point), L11 (unequal spans on one grid).
- `references/references.md`: committed direction, plus a take-from map by typography, layout, pacing, colour.

## Tokens
- `app/tokens.css` is the single token file: palette (paper, ink, accent plus tints), 1.25 type scale to 61px, line heights, faces, weights, 2px radius, 12-column page width and measure. D10, T2, L1, L2.
- `scripts/check-tokens.mjs` (`npm run lint:tokens`) fails on off-scale spacing, shadows, blur, gradients, radii over 2px, arbitrary sizes and borders over 1px.

## Layout
- Type: Fraunces (titles) + Inter (text) + system mono (data), self-hosted via `@fontsource-variable`. Ref 3, T1, T9.
- Hub: large headline, a three-part row (facts / pitch / Fig. 1 run steps), then two featured bots in a 7/5 split, then ruled rows for any further bots. Ref 14, L10, L11, L5. The first two bots in `bots.json` are the featured ones.
- Bot page: large title, ruled five-cell metadata row (version, status, first release, latest update, downloads), 7-column reading column and a sticky 4-column download panel. Ref 11 (Fig. labels), L3.
- About: prose in a 3/7 split with a ruled licence table. Copy corrected: the site does set one anonymous cookie (`lb_vid`) to count downloads and votes, so "no analytics, no cookies" was untrue and is gone.
- Tags and status are quiet mono text (D4, A10); `Tag.tsx` replaced by `TagList.tsx`.
- Header and footer are left-aligned on the 3/9 grid; no pill, no blur. Links are underlined (T10).
- Styled loading skeletons shaped like each page; styled 404 listing real bots; styled "nothing matches" state with a clear button.

## Motion (Framer Motion, `lib/motion.ts`)
- One ease `[0.22, 1, 0.36, 1]`, 160/320/400ms. Springs removed. M1.
- Page transition: 6px rise and fade in `app/template.tsx`.
- Grid reveals once on entering the viewport, with stagger on the first wave only. M3.
- Card hover: border and background change, arrow nudges 2px (CSS). Buttons: colour change, no lift. M6, A16.
- Filtering: cards use `layout="position"` inside `AnimatePresence mode="popLayout"`, so they glide to new positions.
- **Filter bug fixed.** Cause: cards animated back in only through `whileInView`, which had already fired once, so a card that re-matched while its exit animation was running stayed at opacity 0. Cards now have an explicit `animate` target. Checked in a real browser: 3 rounds clicking every tag, rapid typing and clearing, empty state and back; all cards ended at opacity 1.
- `Count` rolls numbers up for downloads and upvotes. Reduced motion sets values instantly. M4.

## Not done
- Stars: the data and site have no star count and no GitHub API integration, so the metadata row has no stars. Adding it means new fetching, not a presentation change.
