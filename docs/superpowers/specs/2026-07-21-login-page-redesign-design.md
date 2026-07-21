# Login Page Redesign — Design Spec

## Goal

Replace the current bare-bones login form (`app/login/page.js`) with a properly designed page that carries the WorkOS logo and matches DESIGN.md's "premium, calm, enterprise-ready" direction. Scope is the login page only — no signup/forgot-password UI, since no such backend flow exists.

## Layout

**Desktop (≥ 768px): split screen, two equal panels. Branding panel is theme-aware** — two logo assets exist in `public/`: `logo.png` (white mark on black, for dark mode) and `logo-light.png` (black mark on near-white, for light mode).

- **Left panel** — background and logo swap with the site theme (see Branding panel color below), centered content:
  - Logo mark (`next/image`, ~64px rendered): `logo.png` in dark mode, `logo-light.png` in light mode.
  - Wordmark "WorkOS" below the mark — white text in dark mode, `var(--primary)` in light mode. ~17px/600 weight.
  - Tagline "Team & project management" below that, `var(--muted)` (readable in both themes), ~12px.
- **Right panel** — `var(--background)` surface, centered form column (max-width ~320-360px):
  - Heading "Welcome back" (Heading 4 scale, 20px/600 per DESIGN.md type scale).
  - Subtext "Sign in to your workspace", `var(--muted)`.
  - Form: Email input, Password input, Sign in button, API error alert — same fields/validation as today, restyled with labels above inputs, `var(--radius-input)` / `var(--radius-btn)`.

**Mobile (< 768px): single column, panel collapses.**

- Branding panel becomes a compact top band, same theme-aware background/logo swap, small logo mark (~36px) + "WorkOS" wordmark only (drop the tagline to save vertical space), fixed padding (not full-height).
- Form panel below it, full-width, same field set, stacked per DESIGN.md mobile guidance (cards/content stack vertically).

## Branding panel color

Each logo asset has a solid, near-uniform background baked in (verified by pixel sampling): `logo.png` is pure black (`rgb(0,0,0)`), `logo-light.png` is near-white (`rgb(254,254,254)`, effectively `var(--surface)`'s `#ffffff`). To keep the logo edge invisible against its panel:

- **Dark mode**: panel background is literal `#000` (not a token — `--background` in dark mode is `#171614`, which would show a seam against the pure-black PNG) with `logo.png`.
- **Light mode**: panel background is `var(--surface)` (`#ffffff`, an exact match to `logo-light.png`'s background) with `logo-light.png`, plus a `var(--border)` right edge to separate it from the form panel (which sits on `var(--background)`, `#faf9f7` — close enough to white that a hairline border keeps the split legible).

Both panel variants are driven by the existing `data-theme="dark"` root attribute (already set pre-paint via `localStorage`, see `app/layout.js`) — a CSS/conditional-class switch, not new theme plumbing.

## Content/copy

- Wordmark: "WorkOS"
- Tagline: "Team & project management"
- Heading: "Welcome back"
- Subtext: "Sign in to your workspace"
- No forgot-password link, no signup link, no "remember me" — none of these have backend support and DESIGN.md scope is an internal, admin-provisioned tool.

## Behavior (unchanged from current implementation)

- `react-hook-form` + `yup` validation (email required/valid, password required), inline error text below each field.
- API error surfaced as an alert box above the fields (existing `apiError` state / styling pattern).
- Submit button shows "Signing in…" and disables while `isSubmitting`.
- On success: `setAuth(data)` then `router.replace("/dashboard")` — unchanged.

## Out of scope

- Forgot-password / signup flows (no backend).
- Social login / SSO.
- Any new logo asset processing — `public/logo.png` and `public/logo-light.png` are used as-is (already provided), sized down, each on its matching panel background.

## Files touched

- `app/login/page.js` — full rewrite of markup/styling; form logic (schema, submit handler, store/router calls) stays the same.
- `app/globals.css` — small appended rule block for the theme-aware branding panel background/text color, following the existing `.theme-dark-only`/`.theme-dark-hidden` convention already in this file.
