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
- Not fixing `yarn lint`. It is broken repo-wide and independently of this change: the script
  is `next lint`, which Next 16 removed, so it exits with
  `Invalid project directory provided, no such directory: <root>/lint`. `package.json` is
  untouched by this PR. Flagged for a separate change.

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

1. A headless-Chrome harness renders the real agenda-sidebar DOM against CSS compiled by the
   project's own Tailwind v4 pipeline, at a desktop viewport, and measures the text block's
   width — before and after the fix.
2. A source-reading regression guard, following the repo's existing idiom for defects with no
   logic to unit-test (`src/modules/judging/__tests__/results-header.test.ts`).

## Risks

- **Low.** CSS-only change to one presentational component.
- `grid-cols-[repeat(auto-fit,...)]` is an arbitrary-value utility, so it only works if
  Tailwind's content scanner sees it. Confirmed twice: compiled from the real `.tsx` source,
  and present in the production stylesheet after `yarn build`. The same
  `minmax(min(100%,Nrem),1fr)` pattern is already used elsewhere in the shipped CSS (9rem,
  12rem), so this is existing house style rather than a new idiom.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Reproduce

- [x] 1.1 Build the headless-browser harness and measure the collapse on current code

### Phase 2: Fix

- [x] 2.1 Make the info-cards grid container-driven instead of viewport-driven — af4271b
- [x] 2.2 Give the card text block `min-w-0 flex-1` and wrap long labels — af4271b

### Phase 3: Verify

- [x] 3.1 Re-measure with the fix and capture screenshot evidence
- [x] 3.2 Run the validation gate

## Measured results

Headless Chrome, 1440px viewport, CSS compiled by the project's own Tailwind v4 pipeline,
rendering the real agenda-sidebar ancestor chain:

| probe | text block width | card width | value lines |
|---|---|---|---|
| before | **0px** | 56px | **32** (one per character) |
| after | 172px | 258px | 2 |

Full-width layout column count: **4 before, 4 after** — no visual regression.
Tailwind's content scanner emits the arbitrary grid class from the real `.tsx` source
(verified against the compiled stylesheet).

## Validation gate

| command | result |
|---|---|
| `yarn generate` | pass |
| `yarn typecheck` | pass |
| `yarn lint` | **fails repo-wide, pre-existing** — `next lint` was removed in Next 16 |
| `yarn test` | pass — 46 suites, 531 tests (6 new) |
| `yarn build` | pass |

Regression guard added in 3ce3dec; 5 of its 6 tests fail against the pre-fix component.
