# Login Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current bare-bones `app/login/page.js` with a split-screen layout that shows a theme-aware WorkOS logo (dark-panel `logo.png` in dark mode, light-panel `logo-light.png` in light mode) alongside a restyled sign-in form, matching DESIGN.md.

**Architecture:** One page component (`app/login/page.js`) rewritten to a two-panel flex layout, reusing the existing `Input`/`Button` primitives from `components/ui/Field.jsx` for the form and the existing `.theme-dark-only`/`.theme-dark-hidden` CSS-toggle convention (already in `app/globals.css`, used today for the theme-toggle icon) to swap the logo image and panel colors without any client-side theme detection — avoids a hydration mismatch, since the actual theme is only known via a pre-paint inline script writing `document.documentElement.dataset.theme`, not during SSR render.

**Tech Stack:** Next.js 16 (App Router, JS only), Tailwind v4 (CSS custom-property tokens defined in `app/globals.css`), `react-hook-form` + `yup`, `next/image`.

## Global Constraints

- No signup / forgot-password / "remember me" UI — no backend support exists for these flows (spec: Content/copy, Out of scope).
- Branding panel background/logo pairing is fixed by asset background color, not a design token: dark mode = literal `#000` + `logo.png`; light mode = `var(--surface)` (`#ffffff`) + `logo-light.png`, with a `var(--border)` right edge in light mode only (spec: Branding panel color).
- Form panel and all form elements use existing design tokens (`var(--background)`, `var(--border)`, `var(--muted)`, `var(--danger)`, `var(--radius-input)`, `var(--radius-btn)`) — never raw hex, except the two literal panel exceptions above (spec: Content/copy, Color Philosophy in DESIGN.md).
- Reuse `Input`/`Button` from `components/ui/Field.jsx` instead of hand-rolled markup — this is the existing shared pattern for forms elsewhere in the app; the current login page predates it and is the one place still hand-rolling inputs.
- Auth logic (`schema`, `onSubmit`, `useAuthStore`, `login()` service call, `router.replace("/dashboard")`) is unchanged — this plan only touches markup/styling (spec: Behavior).
- No test framework exists on the frontend (`package.json` has no test script) — verification for this plan is `npm run lint`, `npm run build`, and manual browser checks across the theme/breakpoint matrix below, per this project's established UI-change verification style.

---

### Task 1: Theme-aware branding panel + login page rewrite

**Files:**
- Modify: `app/globals.css` (append new rule block; no existing rules touched)
- Modify: `app/login/page.js:1-95` (full rewrite of the JSX return; imports/schema/state/handler logic unchanged)

**Interfaces:**
- Consumes: `Input`, `Button` from `@/components/ui/Field` (signatures: `Input({ label, error, ...props })` renders a labeled `<input>` with error text below; `Button({ variant = "primary", className, ...props })` renders a styled `<button>`). Consumes existing `.theme-dark-only` / `.theme-dark-hidden` classes from `app/globals.css:225-230` (display:none toggle keyed on `:root[data-theme="dark"]`).
- Produces: nothing consumed by later tasks — this is the only task in the plan.

- [ ] **Step 1: Add the branding-panel CSS rule to `app/globals.css`**

Append this block at the end of `app/globals.css` (after the existing theme-toggle-icon rules at the bottom of the file):

```css
/* Login branding panel: background must exactly match whichever logo
   asset is showing (logo.png is pure #000, logo-light.png is #fff) so
   there's no visible seam around the square PNG. Swaps with data-theme,
   same convention as the theme-toggle icons above. */
.login-brand-panel {
  background: #000;
}
:root:not([data-theme="dark"]) .login-brand-panel {
  background: var(--surface);
  border-right: 1px solid var(--border);
}

.login-wordmark {
  color: #ffffff;
}
:root:not([data-theme="dark"]) .login-wordmark {
  color: var(--primary);
}
```

- [ ] **Step 2: Rewrite `app/login/page.js`**

Replace the entire file with:

```jsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { useAuthStore } from "@/store/authStore";
import { login } from "@/services/authService";
import { Input, Button } from "@/components/ui/Field";

const schema = yup.object({
  email: yup.string().email("Enter a valid email").required("Email is required"),
  password: yup.string().required("Password is required"),
});

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [apiError, setApiError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: yupResolver(schema) });

  const onSubmit = async (values) => {
    setApiError("");
    try {
      const data = await login(values);
      setAuth(data);
      router.replace("/dashboard");
    } catch (error) {
      setApiError(error.response?.data?.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      <div className="login-brand-panel flex flex-col items-center justify-center gap-3 py-8 md:min-h-screen md:w-1/2 md:gap-4 md:py-0">
        <Image
          src="/logo.png"
          alt=""
          width={64}
          height={64}
          priority
          className="theme-dark-only h-10 w-10 md:h-16 md:w-16"
        />
        <Image
          src="/logo-light.png"
          alt=""
          width={64}
          height={64}
          priority
          className="theme-dark-hidden h-10 w-10 md:h-16 md:w-16"
        />
        <span className="login-wordmark text-base font-semibold tracking-tight md:text-lg">
          WorkOS
        </span>
        <span className="hidden text-xs text-muted md:block">Team &amp; project management</span>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Sign in to your workspace</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
            {apiError && (
              <p
                role="alert"
                className="rounded-input border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
              >
                {apiError}
              </p>
            )}

            <Input
              label="Email"
              id="email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />

            <Input
              label="Password"
              id="password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors (warnings pre-existing elsewhere in the repo are fine; there must be none newly introduced in `app/login/page.js` or `app/globals.css`).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds, no type/compile errors, `/login` route listed in the output.

- [ ] **Step 5: Manual verification in the browser**

Run: `npm run dev`, then open `http://localhost:3000/login`.

Check this matrix (toggle theme via whatever triggers `localStorage.setItem("theme", "dark"|"light")` in this app — e.g. the existing theme toggle control once logged in, or `localStorage.setItem("theme","dark")` + reload from the browser console since this page is reachable pre-auth):

| Viewport | Theme | Expect |
|---|---|---|
| Desktop (≥768px) | Light | Left panel white (`#fff`) with a visible hairline right border, black-mark `logo-light.png`, dark wordmark. Right panel warm off-white (`var(--background)`), form centered. |
| Desktop (≥768px) | Dark | Left panel pure black, no border, white-mark `logo.png`, white wordmark. Right panel dark background. |
| Mobile (<768px, e.g. 375px) | Light | Compact top band (white, bordered bottom via the panel's own edge — layout is column so no explicit bottom border needed, panel is just short), logo + wordmark only (no tagline), form stacked below. |
| Mobile (<768px) | Dark | Same compact top band, black background, `logo.png`. |

Also verify, in either theme:
- Submitting empty form shows "Email is required" / "Password is required" inline under each field.
- Submitting an invalid email shows "Enter a valid email".
- Submitting valid credentials against a running backend redirects to `/dashboard`; invalid credentials show the red API-error banner above the fields.
- Button shows "Signing in…" and is disabled while the request is in flight.

Expected: all rows in the matrix match, no visible seam between the logo image and its panel background in either theme, no console errors/warnings from `next/image`.

- [ ] **Step 6: Commit**

This project has no git repository at `~/Projects/wos` (deliberately removed) — skip this step. If a repo has since been reinitialized, confirm with the user before running `git add`/`git commit`.
