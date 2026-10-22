# Typography

- **T1 Three roles, self-hosted:** one display face for titles (Fraunces), one text face (Inter), and the system monospace for data (versions, commands, file names, hashes). Pairing taken from reference 3. Amended 2026-10-22 on the owner's request for a display + body pairing; before that it was one text face plus mono.
- **T2 Scale:** ratio 1.25 from a 16px base, as tokens: 12, 14, 16, 20, 25, 31, 39 (px, expressed in rem). Use no other sizes. Amended 2026-10-22: two display steps continue the ratio, 49 and 61, for page titles only.
- **T3 Weights:** 400 and 600/700 only. Emphasis by size/weight, not colour (D4). Italic only for titles and true emphasis.
- **T4 Measure:** prose is 60–72 characters wide (`max-width: 68ch`). Tables and lists may be wider.
- **T5 Line height:** 1.5 for body, 1.2 for headings (1.1 at the 49px and 61px display steps), 1.4 for small/mono text. Tokenised.
- **T6 Alignment:** left-aligned, ragged right. No justified text. Centered text only for a single short line that has a reason.
- **T7 Numerals:** data columns use tabular figures (`font-variant-numeric: tabular-nums`) and are right-aligned when numeric.
- **T8 Letter-spacing:** none on body or headings. Small uppercase labels are not used; use size/weight instead.
- **T9 System or self-hosted fonts.** Fonts ship as npm packages (`@fontsource-variable/*`), no font CDN at runtime. Honest, readable defaults beat decorative faces.
- **T10 Links are underlined** (with `text-underline-offset`). Never rely on colour alone.
