# Fix collapsed info-card layout in the competition portal

## Goal

Stop `CompetitionInfoCards` from collapsing its text block to zero width, which renders
card values one character per line (see the reported screenshot of the agenda sidebar).

## Root cause

`CompetitionInfoCards` hard-codes viewport breakpoints on its grid:

```
grid gap-3 sm:grid-cols-2 xl:grid-cols-4
```

Media-query breakpoints track the **viewport**, not the element's container. On the agenda
page the component is rendered inside a fixed 300px sidebar
(`grid gap-6 lg:grid-cols-[1fr_300px]`), so on any desktop viewport `xl:grid-cols-4` splits
that 300px sidebar into four ~57px columns.

The agenda call site tries to opt out with `gridClassName="grid-cols-1"`, but that override
cannot work: `cn()` is `tailwind-merge`, which keys classes by *variant + utility group*.
Unprefixed `grid-cols-1` and `xl:grid-cols-4` are different groups, so both classes survive
and the `xl` rule still wins inside its media query.

Inside a ~57px card (`p-3` → ~33px of content) the row is
`icon (40px, shrink-0) + gap (12px) + text block`. The text block is `min-w-0` with no
`flex-1`, so it shrinks to **width: 0**. Its children then overflow:

- the label (`WIFI ACCESS`, no `break-words`) breaks at the space — one word per line;
- the value (`break-words`) may break anywhere, so it breaks after **every character**.

That is exactly the reported rendering.

## Scope

- `src/modules/competitions/components/CompetitionInfoCards.tsx` — the grid track and the
  flex row.

## Non-goals

- No changes to info-card data, API, validators, entities or the backend CRUD pages.
- No redesign of the card's visual style; the desktop column counts must stay as they are.
- No new test framework. This repo currently ships no jest config and no test files, so
  `yarn test` cannot run; bootstrapping it is out of scope for a CSS fix. Verification is a
  measured headless-browser render instead (see Risks).

## Fix

1. Replace the viewport-breakpoint track with a container-driven one:

   ```
   grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))]
   ```

   `auto-fit` sizes from the actual container width, so a narrow sidebar gets one column no
   matter how wide the viewport is. `min(100%,16rem)` keeps the track from overflowing a
   container narrower than 16rem. The 16rem floor reproduces today's column counts in the
   full-width layout (4 columns at `max-w-6xl`, 2 at `sm`, 1 on mobile).

2. Give the text block the correct flex idiom `min-w-0 flex-1` so it claims the remaining
   row width instead of sizing to content.

3. Add `break-words` to the label so a long single-word label wraps instead of overflowing
   the card.

## Verification

A headless-Chrome harness renders the real agenda-sidebar DOM against CSS compiled by the
project's own Tailwind v4 pipeline, at a desktop viewport, and measures the text block's
width — before and after the fix. Expected: 0px before, >150px after.

## Risks

- **Low.** CSS-only change to one presentational component.
- `grid-cols-[repeat(auto-fit,...)]` is an arbitrary-value utility; it is a literal string in
  the source file so Tailwind's content scanner picks it up. The measured render confirms the
  class actually emits CSS.
- `yarn test` is not runnable in this repo (no jest config, zero test files); the validation
  gate is run without it and the gap is disclosed on the PR.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Reproduce

- [ ] 1.1 Build the headless-browser harness and measure the collapse on current code

### Phase 2: Fix

- [ ] 2.1 Make the info-cards grid container-driven instead of viewport-driven
- [ ] 2.2 Give the card text block `min-w-0 flex-1` and wrap long labels

### Phase 3: Verify

- [ ] 3.1 Re-measure with the fix and capture screenshot evidence
- [ ] 3.2 Run the validation gate
