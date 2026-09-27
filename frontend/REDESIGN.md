# Sahayak Frontend Redesign — Design System Guide

This repo is mid-redesign to a **Google-product visual language** (Material 3 principles, light mode).
The foundation (tokens, global classes, core components, layouts) is DONE. Your job is to restyle
individual pages/feature components to match, **without changing any functionality**.

## Non-negotiable rules

1. **Do not change behavior.** No changes to API calls, hooks, state, routing, form logic, event
   handlers, i18n keys, or exported component names/props. Only markup structure and classes may change.
2. **Do not edit files outside your assigned list.** Other agents are working in parallel.
3. Use the existing Tailwind palette — it has already been remapped to Google colors:
   - `forest-*` = primary blue (50 #e8f0fe, 100 #d3e3fd tonal, 600 #1a73e8, 700 #1967d2, 800 #0b57d0)
   - `ink-*` = Google grey ramp (900/800 text, 600 secondary text, 500 meta, 300 borders, 100 fills, 50 bg)
   - `paper-*` = surfaces (100 #f8fafd page bg, 200 #f1f3f4 fill, 300 #e1e3e6 borders)
   - `saffron-*` = blue accent (progress, citations, "processing" states)
   - `leaf-*` = success green, `amber-*` = warning, `brick-*` = error red (#d93025)
4. **Weight discipline:** use `font-medium` (500) for emphasis/titles, `font-normal` for body.
   Never `font-semibold`/`font-bold`/`font-extrabold` — Google products use regular+medium only.
   Replace any `font-bold`/`font-semibold` you touch with `font-medium`.
5. **Radii:** buttons/chips/pills = `rounded-full`; cards/panels = `rounded-xl`; dialogs/sheets =
   `rounded-3xl`; inputs = `rounded-lg`. Never `rounded-md` on interactive elements you touch;
   no arbitrary new radii.
6. **Shadows:** only `shadow-card` (resting) and `shadow-lift` (dialogs/menus/hover). Nothing else.
7. **Color = state, not decoration.** Surfaces are white/`paper-100`; blue appears on primary actions,
   active states, links, and focus. No gradients (except existing `.greet-surface`), no colored card
   backgrounds other than tonal status fills (`leaf-50`, `amber-50`, `brick-50`, `forest-50`).
8. **Icons:** lucide-react only, sizes 16–21px, `text-ink-500` default, `text-forest-600/700` when active
   or meaningful. No emoji as icons.
9. **Remove** any `tricolor-rule`, `hero-surface`, `hero-building`, `font-display` usages you encounter
   (font-display still works but should be dropped — headings are plain sans now).
10. Respect `prefers-reduced-motion` (already global). Keep animations short (≤300ms),
    `cubic-bezier(.2,0,0,1)` easing. Stagger lists only via existing `.stagger` class.

## Shared building blocks (use these, don't reinvent)

From `src/components/ui.tsx`: `PageHeader` (eyebrow/title/subtitle/actions), `StatusPill`,
`ProgressBar`, `EmptyState` (icon in tonal circle + title + children — always pass an icon and a
helpful action when the list can be empty), `Modal`, `Drawer`, `Tabs`, `SkeletonList`, `ErrorNote`,
`DemoBadge`, `Spinner`, `formatDate`.

Global classes (see `src/index.css`): `.btn-primary` (filled blue), `.btn-accent` (tonal blue),
`.btn-secondary` (outlined), `.btn-ghost`, `.btn-danger`, `.btn-sm`/`.btn-lg`, `.card`, `.card-link`,
`.input`, `.label`, `.chip`, `.eyebrow`, `.link`, `.section-title`, `.page-title`, `.panel-title`,
`.nav-item` + `.nav-item-active`, `.skeleton`, `.greet-surface`, `.stagger`.

## Patterns to apply

- **Page structure:** `<PageHeader>` at top, then content. Max text width for descriptions `max-w-2xl`.
- **Lists/tables:** clean rows, `border-paper-300` dividers, row `hover:bg-ink-50`, generous padding
  (`py-3.5 px-4`), secondary text `text-sm text-ink-600`, meta `text-xs text-ink-500`.
- **Stat/metric blocks:** big number `text-2xl font-medium text-ink-900`, label `text-sm text-ink-600`.
  No colored backgrounds on stat cards — white cards only.
- **Empty states:** `<EmptyState icon={<Icon/>} title="…">explanation + <button className="btn-primary btn-sm mt-4">` action.
- **Loading:** `SkeletonList` or `.skeleton` blocks shaped like final content — not spinners
  (except inline buttons / full-page charkha which already exists).
- **Errors:** `ErrorNote` for inline; for failed page loads: icon + "Something went wrong" + plain-
  language explanation + "Try again" `.btn-secondary`.
- **Forms:** `.label` + `.input`, helper text `text-xs text-ink-500`, errors `text-xs text-brick`,
  primary submit `.btn-primary` full-width on mobile (`w-full sm:w-auto`).
- **Mobile:** everything must work at 390px — grids collapse to 1 column, no horizontal scroll,
  touch targets ≥44px.
- **Active/selected:** tonal pill `bg-forest-100 text-forest-800`; hover on interactive rows `hover:bg-ink-50`.

## Verify

After editing, run `npx tsc -b --noEmit` from `/media/newvolume/projects/BuildForBillions26/frontend`
and fix any type errors in your files. Then run `npm run build` and make sure it succeeds.
