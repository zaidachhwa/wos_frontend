# Google Sign-In

Date: 2026-07-27

## Problem

Add "Sign in with Google" alongside the existing email/password login. Auth today is fully custom: bcrypt password check + a JWT access/refresh pair issued by `backend/src/controllers/authController.js`, no session store, no OAuth library installed on either side.

## Design

### Flow: Google ID-token verification, not a server-driven redirect

Google's Identity Services button runs entirely client-side and hands the frontend a signed ID token; the frontend posts that token to a new backend endpoint, which verifies it and issues our own JWT pair — the existing token system stays the single source of truth for sessions. A full passport-driven OAuth redirect flow (callback routes, redirect URIs) would add session-cookie machinery this JWT-based API doesn't otherwise have, for no benefit here.

### Backend

- New dependency: `google-auth-library` (nothing installed today covers ID-token verification).
- New env var: `GOOGLE_CLIENT_ID`.
- `User` model: add `googleId: { type: String, default: null, unique: true, sparse: true }`.
- New route `POST /auth/google` (`backend/src/routes/authRoutes.js`), new controller function alongside `login` in `authController.js`:
  1. Verify the posted ID token via `google-auth-library`'s `OAuth2Client.verifyIdToken`, extract `email` (and `sub` as the Google id).
  2. Look up `User` by email.
     - **Found, no `googleId` yet** → set `googleId` on the doc (auto-link), continue to step 3.
     - **Found, `googleId` already set** → continue to step 3.
     - **Not found** → respond `404` with a message telling the user no WorkOS account exists for that email and an admin must invite them first. No account is created.
  3. Issue the same access + refresh token pair as `login` does today (`signAccessToken`/`signRefreshToken`), refresh token as the same httpOnly cookie.

### Frontend

- `frontend/app/login/page.js`: load Google's `accounts.google.com/gsi/client` script, render the Google Sign-In button below the existing email/password form.
- On success callback, POST the returned ID token to `/auth/google` via a new `authService.loginWithGoogle` function (same shape as the existing `login` call), and store the result in `useAuthStore` exactly as password login does today.
- On the backend's 404 ("no account") response, show that message as the form error, same error slot the password form already uses.

## Out of scope / explicitly deferred

- No self-service account creation via Google — every Google sign-in must match an admin-provisioned account by email.
- No change to the refresh/rotation logic, RBAC, or org-membership model — Google is purely an alternate way to authenticate into an existing account.
- No "unlink Google" settings UI unless requested later.
