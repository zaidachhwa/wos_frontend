# Google Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user with an existing WorkOS account sign in via a Google button on the login page, using the same JWT access/refresh session the password login already issues.

**Architecture:** Frontend loads Google's Identity Services script and gets a signed ID token client-side; it posts that token to a new `POST /auth/google` backend endpoint, which verifies it with `google-auth-library`, looks the email up against `User`, and — only if a matching account already exists — links `googleId` and issues the same token pair `login` does today. No new account is ever created by this endpoint.

**Tech Stack:** `google-auth-library` (new backend dependency), Google Identity Services (`accounts.google.com/gsi/client`, loaded via `<script>`, no new frontend dependency).

## Global Constraints

- Google sign-in never self-provisions an account — an email with no existing `User` gets a 404, not a new user.
- No changes to refresh-token rotation, RBAC, or org-membership logic — this endpoint only adds a second way to *authenticate into* an existing account.
- Spec: `docs/superpowers/specs/2026-07-27-google-oauth-signin-design.md`
- **Requires manual setup you must do, not something this plan can automate:** a real Google OAuth Client ID from Google Cloud Console (APIs & Services → Credentials → OAuth client ID → Web application), with your frontend origin(s) added to "Authorized JavaScript origins". Until `GOOGLE_CLIENT_ID` (backend) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend) are set to a real value, the button won't render/authenticate against Google — Task 3's manual browser check depends on this.

---

### Task 1: Backend — `googleId` field, `google-auth-library`, `/auth/google` endpoint

**Files:**
- Modify: `backend/package.json` (add `google-auth-library` dependency)
- Modify: `backend/src/models/User.js:15-23`
- Modify: `backend/src/controllers/authController.js`
- Modify: `backend/src/routes/authRoutes.js`
- Modify: `backend/scripts/smoke-auth.js`

**Interfaces:**
- Produces: `POST /auth/google` — body `{ credential: string }` (the Google ID token), returns the same shape as `POST /auth/login` (`{ success, message, data: { user, accessToken } }`) plus the `refreshToken` cookie, on success. `400` if `credential` missing, `401` if the token doesn't verify, `404` if no `User` matches the token's email.

- [ ] **Step 1: Add the dependency**

Run: `cd backend && npm install google-auth-library`
Expected: `backend/package.json` gains `"google-auth-library"` under `dependencies`; `backend/package-lock.json` updates; exit code 0.

- [ ] **Step 2: Add `googleId` to the User model**

In `backend/src/models/User.js`, add a new field after line 15 (`isActive: { type: Boolean, default: true },`):

```js
    // Set the first time a matching account signs in via Google. Unique +
    // sparse so multiple users can each have no googleId (null) without
    // violating the unique index.
    googleId: { type: String, default: null, unique: true, sparse: true },
```

- [ ] **Step 3: Add the `loginWithGoogle` controller**

In `backend/src/controllers/authController.js`, add the import after line 2:

```js
import { OAuth2Client } from "google-auth-library";
```

Add, after the `signAccessToken`/`signRefreshToken` import (line 5):

```js
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
```

Add this new exported function after `login` (after line 51, before `export const refresh`):

```js
export const loginWithGoogle = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: "Google credential is required" });
    }

    let googlePayload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      googlePayload = ticket.getPayload();
    } catch {
      return res.status(401).json({ success: false, message: "Invalid Google token" });
    }

    const email = String(googlePayload.email || "").toLowerCase();
    const user = await User.findOne({ email });
    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "No WorkOS account found for this Google email. Ask an admin to invite you.",
      });
    }

    // Auto-link on first Google sign-in — one account per email, either
    // login method works afterward.
    if (!user.googleId) {
      user.googleId = googlePayload.sub;
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    user.refreshToken = refreshToken;
    user.previousRefreshToken = null;
    user.previousRefreshTokenExpiresAt = null;
    await user.save();
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);
    const safeUser = await User.findById(user._id).populate("department team");
    return res.json({ success: true, message: "Logged in", data: { user: safeUser, accessToken } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};
```

- [ ] **Step 4: Add the route**

In `backend/src/routes/authRoutes.js`, change line 3:

```js
import { login, refresh, logout, me } from "../controllers/authController.js";
```

to:

```js
import { login, loginWithGoogle, refresh, logout, me } from "../controllers/authController.js";
```

and add, after line 8 (`router.post("/login", login);`):

```js
router.post("/google", loginWithGoogle);
```

- [ ] **Step 5: Extend the auth smoke test**

`verifyIdToken` needs a real Google-signed token, which a smoke script can't produce — so this test only covers the deterministic failure paths (missing/garbage credential), not the success path. The success path (real Google button → real token → account link) is verified manually in Task 3.

In `backend/scripts/smoke-auth.js`, add before the final `console.log("smoke-auth: all checks passed");` (line 64):

```js
  const missingCredential = await axios.post(
    `${BASE}/auth/google`,
    {},
    { validateStatus: () => true }
  );
  assert.equal(missingCredential.status, 400, "google login without a credential is rejected");

  const badCredential = await axios.post(
    `${BASE}/auth/google`,
    { credential: "not-a-real-google-token" },
    { validateStatus: () => true }
  );
  assert.equal(badCredential.status, 401, "google login with an unverifiable token is rejected");
```

- [ ] **Step 6: Set the env var placeholder and run the smoke suite**

`google-auth-library`'s `OAuth2Client` construction doesn't require `GOOGLE_CLIENT_ID` to be set to run `npm run smoke` (it only matters once `verifyIdToken` is actually called with a real token, which Step 5's tests never trigger — a garbage token fails signature parsing before the audience is even checked). No `.env` change is required for this step.

Run: `cd backend && npm run smoke`
Expected: `smoke-auth: all checks passed` appears with no assertion errors, followed by the rest of the smoke chain, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/models/User.js backend/src/controllers/authController.js backend/src/routes/authRoutes.js backend/scripts/smoke-auth.js
git commit -m "feat: add Google ID-token sign-in endpoint with account auto-link by email"
```

---

### Task 2: Frontend — Google button on the login page

**Files:**
- Modify: `frontend/services/authService.js`
- Modify: `frontend/app/login/page.js`

**Interfaces:**
- Consumes: `POST /auth/google` from Task 1.
- Produces: `loginWithGoogle(credential: string) => Promise<{ user, accessToken }>` in `authService.js`, used by the login page exactly like the existing `login()` call.

- [ ] **Step 1: Add `loginWithGoogle` to authService**

In `frontend/services/authService.js`, add after the `login` export (after line 6):

```js
export const loginWithGoogle = async (credential) => {
  const { data } = await axiosInstance.post("/auth/google", { credential });
  return data.data;
};
```

- [ ] **Step 2: Load the Google script and render the button**

In `frontend/app/login/page.js`, change the import at line 3:

```js
import { useState } from "react";
```

to:

```js
import { useState, useEffect, useCallback } from "react";
```

and change line 11:

```js
import { login } from "@/services/authService";
```

to:

```js
import { login, loginWithGoogle } from "@/services/authService";
```

Add this after the `onSubmit` function (after line 38, before the `return`):

```js
  const handleGoogleCredential = useCallback(
    async ({ credential }) => {
      setApiError("");
      try {
        const data = await loginWithGoogle(credential);
        setAuth(data);
        router.replace("/dashboard");
      } catch (error) {
        setApiError(error.response?.data?.message || "Something went wrong. Please try again.");
      }
    },
    [router, setAuth]
  );

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return undefined;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      window.google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleCredential });
      const target = document.getElementById("google-signin-button");
      if (target) window.google.accounts.id.renderButton(target, { theme: "outline", size: "large", width: 320 });
    };
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, [handleGoogleCredential]);
```

Add the button mount point in the JSX, after the closing `</form>` (after line 101) and before the closing `</div>` of the form's wrapper `<div className="w-full max-w-sm">`:

```jsx
          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <div id="google-signin-button" className="flex justify-center" />
            </div>
          )}
```

- [ ] **Step 3: Add the frontend env var placeholder**

Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID=` to `frontend/.env.local` (create the file if it doesn't exist; it's already gitignored alongside `.env`). Leave it blank until you have a real Google OAuth Client ID — the button conditionally doesn't render without it, so the rest of the login page is unaffected.

- [ ] **Step 4: Lint and build**

Run: `cd frontend && npm run lint && npm run build`
Expected: both exit 0. The build succeeds even with `NEXT_PUBLIC_GOOGLE_CLIENT_ID` unset, since the button section is conditionally skipped.

- [ ] **Step 5: Manual verification (requires a real Google Client ID)**

Once you've created a Google OAuth Client ID and set both `GOOGLE_CLIENT_ID` (backend `.env`) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend `.env.local`) to it:

Run: `cd backend && npm run dev` and `cd frontend && npm run dev`.
Open `/login`. Confirm the Google button renders below the password form. Sign in with a Google account whose email matches an existing WorkOS user (e.g. the seed admin's email, if that's a real Gmail address you control — otherwise any seeded user's email that's also a real Google account). Confirm it lands on `/dashboard` and `/auth/me` reflects the logged-in user. Sign in with a Google account whose email has no WorkOS user — confirm the page shows the "no WorkOS account found" error instead of logging in.

- [ ] **Step 6: Commit**

```bash
git add frontend/services/authService.js frontend/app/login/page.js
git commit -m "feat: add Google sign-in button to the login page"
```
