# WorkOS Foundation Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working end-to-end auth + RBAC + minimal org data model + base app shell for WorkOS: login → role-aware dashboard against a real Express/Mongo backend.

**Architecture:** Two repos. Backend `/home/zaid/Projects/wos/backend` (new): Express 5 + Mongoose, JWT access token (15m, returned in body, held in memory client-side) + rotating refresh token (7d, HTTP-only cookie, mirrored on the User doc). Frontend `/home/zaid/Projects/wos/frontend`: Next.js 16 App Router, client-side auth bootstrap via Zustand + Axios interceptors, DESIGN.md-tokenized Tailwind v4 shell.

**Tech Stack:** Express 5, Mongoose, bcrypt, jsonwebtoken, cookie-parser, cors | Next.js 16.2, React 19, Tailwind v4, Zustand, Axios, React Hook Form + Yup, lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-09-foundation-design.md`

## Global Constraints

- **JavaScript only** — no TypeScript anywhere (AGENT.md).
- **Backend repo:** `/home/zaid/Projects/wos/backend`, ESM (`"type": "module"`), Node 20 (`--watch`, `--env-file` — no nodemon/dotenv).
- **API envelope, every response:** `{ "success": true|false, "message": "...", "data": {}? }` (AGENT.md).
- **Roles enum, exact strings:** `admin`, `manager`, `sublead`, `member`.
- **Token lifetimes:** `ACCESS_TOKEN_EXPIRES=15m`, `REFRESH_TOKEN_EXPIRES=7d`.
- **Frontend:** Tailwind classes only (no inline styles/CSS modules), Axios only (never `fetch()`), lucide-react icons only, React Hook Form + Yup for forms, Zustand for auth state. Access token in memory only — never localStorage.
- **Design tokens only in components** — no raw hex outside `app/globals.css`. Radii: cards 16px, buttons/inputs 10px. Spacing on the 8pt scale. Animations 150–250ms, fade/slide/scale/collapse only, no bounce.
- **Next.js 16 gotchas** (from `node_modules/next/dist/docs/`): request APIs (`cookies()`, `params`…) are async-only; `middleware.js` is renamed `proxy.js` (we use neither — auth bootstrap is client-side); `next lint` is removed (use `npm run lint` → eslint directly).
- **Commits:** conventional prefixes (`feat:`, `fix:`, `chore:`, `docs:`). All commits go in the single `wos` repo (monorepo: `frontend/` + `backend/`).
- **No test framework** — verification is runnable smoke scripts + curl, per spec.

---

### Task 1: Backend scaffold (repo, Express app, DB connect, health route)

**Files:**
- Create: `/home/zaid/Projects/wos/backend/package.json`
- Create: `/home/zaid/Projects/wos/backend/.gitignore`
- Create: `/home/zaid/Projects/wos/backend/.env.example`
- Create: `/home/zaid/Projects/wos/backend/src/app.js`
- Create: `/home/zaid/Projects/wos/backend/src/server.js`
- Create: `/home/zaid/Projects/wos/backend/src/db/connect.js`
- Create: `/home/zaid/Projects/wos/backend/src/middleware/errorHandler.js`

**Interfaces:**
- Produces: Express `app` (default export of `src/app.js`) that later tasks mount routers onto; `connectDB()` from `src/db/connect.js`; `errorHandler` middleware already mounted last.

- [ ] **Step 1: Initialize the repo and install dependencies**

```bash
mkdir -p /home/zaid/Projects/wos/backend && cd /home/zaid/Projects/wos/backend
git init
npm init -y
npm install express mongoose bcrypt jsonwebtoken cookie-parser cors axios
```

- [ ] **Step 2: Set package.json to ESM with scripts**

Edit `package.json` so it contains (keep the generated `dependencies` block):

```json
{
  "name": "wos-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch --env-file=.env src/server.js",
    "start": "node --env-file=.env src/server.js",
    "seed": "node --env-file=.env scripts/seed.js",
    "smoke": "node --env-file=.env scripts/smoke-auth.js && node --env-file=.env scripts/smoke-users.js"
  }
}
```

- [ ] **Step 3: Create .gitignore and .env.example**

`.gitignore`:

```text
node_modules/
.env
```

`.env.example`:

```env
PORT=5000
MONGODB_URI=
CLIENT_ORIGIN=http://localhost:3000
ACCESS_TOKEN_SECRET=
REFRESH_TOKEN_SECRET=
ACCESS_TOKEN_EXPIRES=15m
REFRESH_TOKEN_EXPIRES=7d
SEED_ADMIN_EMAIL=admin@wos.local
SEED_ADMIN_PASSWORD=
```

Then create a real `.env` from it. Ask the user for `MONGODB_URI` if not provided; generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

(run twice, one value per secret; pick a real `SEED_ADMIN_PASSWORD`, min 8 chars).

- [ ] **Step 4: Write src/db/connect.js**

```javascript
import mongoose from "mongoose";

export const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");
};
```

- [ ] **Step 5: Write src/middleware/errorHandler.js**

```javascript
export const errorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
};
```

- [ ] **Step 6: Write src/app.js**

```javascript
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "OK" });
});

app.use(errorHandler);

export default app;
```

- [ ] **Step 7: Write src/server.js**

```javascript
import app from "./app.js";
import { connectDB } from "./db/connect.js";

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`API listening on ${PORT}`));
  } catch (error) {
    console.error("Failed to start:", error.message);
    process.exit(1);
  }
};

start();
```

- [ ] **Step 8: Verify the server boots and health responds**

```bash
cd /home/zaid/Projects/wos/backend && npm run dev &
sleep 3
curl -s http://localhost:5000/api/health
```

Expected: `MongoDB connected`, `API listening on 5000`, and `{"success":true,"message":"OK"}`. Kill the background server after.

- [ ] **Step 9: Commit**

```bash
cd /home/zaid/Projects/wos/backend
git add -A
git commit -m "feat: scaffold express server with db connection and health route"
```

---

### Task 2: Models (User, Department, Team) + roles constant

**Files:**
- Create: `/home/zaid/Projects/wos/backend/src/constants/roles.constants.js`
- Create: `/home/zaid/Projects/wos/backend/src/models/User.js`
- Create: `/home/zaid/Projects/wos/backend/src/models/Department.js`
- Create: `/home/zaid/Projects/wos/backend/src/models/Team.js`

**Interfaces:**
- Produces: `ROLES` array (named export); Mongoose models `User`, `Department`, `Team` (default exports). `User.password` and `User.refreshToken` have `select: false` — auth code must use `.select("+password")` / `.select("+refreshToken")`.

- [ ] **Step 1: Write src/constants/roles.constants.js**

```javascript
export const ROLES = ["admin", "manager", "sublead", "member"];
```

- [ ] **Step 2: Write src/models/User.js**

```javascript
import mongoose from "mongoose";

import { ROLES } from "../constants/roles.constants.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    designation: { type: String, default: "" },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isActive: { type: Boolean, default: true },
    refreshToken: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
```

- [ ] **Step 3: Write src/models/Department.js**

```javascript
import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("Department", departmentSchema);
```

- [ ] **Step 4: Write src/models/Team.js**

```javascript
import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Team", teamSchema);
```

- [ ] **Step 5: Verify models load without error**

```bash
cd /home/zaid/Projects/wos/backend
node --input-type=module -e "import('./src/models/User.js').then(() => import('./src/models/Department.js')).then(() => import('./src/models/Team.js')).then(() => console.log('models OK'))"
```

Expected: `models OK`

- [ ] **Step 6: Commit**

```bash
git add src/constants src/models
git commit -m "feat: add user, department and team models"
```

---

### Task 3: Auth (tokens, controller, middleware, routes)

**Files:**
- Create: `/home/zaid/Projects/wos/backend/src/utils/tokens.js`
- Create: `/home/zaid/Projects/wos/backend/src/middleware/auth.js`
- Create: `/home/zaid/Projects/wos/backend/src/controllers/authController.js`
- Create: `/home/zaid/Projects/wos/backend/src/routes/authRoutes.js`
- Modify: `/home/zaid/Projects/wos/backend/src/app.js`

**Interfaces:**
- Consumes: `User` model (Task 2).
- Produces: `authenticate` (sets `req.user` to a full User doc) and `authorize(...roles)` middleware for all later routes. Endpoints: `POST /api/auth/login` → `{success, message, data: {user, accessToken}}`; `POST /api/auth/refresh` → `{data: {accessToken}}` (rotates cookie); `POST /api/auth/logout`; `GET /api/auth/me` → `{data: {user}}`. Refresh cookie name: `refreshToken`, path `/api/auth`.

- [ ] **Step 1: Write src/utils/tokens.js**

```javascript
import jwt from "jsonwebtoken";

export const signAccessToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES || "15m",
  });

export const signRefreshToken = (user) =>
  jwt.sign({ sub: user._id.toString() }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES || "7d",
  });
```

- [ ] **Step 2: Write src/middleware/auth.js**

```javascript
import jwt from "jsonwebtoken";

import User from "../models/User.js";

export const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }
};

export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
```

- [ ] **Step 3: Write src/controllers/authController.js**

```javascript
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import { signAccessToken, signRefreshToken } from "../utils/tokens.js";

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }
    const user = await User.findOne({ email: String(email).toLowerCase() }).select("+password");
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    user.refreshToken = refreshToken;
    await user.save();
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);
    const safeUser = await User.findById(user._id).populate("department team");
    return res.json({ success: true, message: "Logged in", data: { user: safeUser, accessToken } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const refresh = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    let payload;
    try {
      payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    const user = await User.findById(payload.sub).select("+refreshToken");
    if (!user || !user.isActive || user.refreshToken !== token) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    const accessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);
    user.refreshToken = newRefreshToken;
    await user.save();
    res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);
    return res.json({ success: true, message: "Token refreshed", data: { accessToken } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
        await User.findByIdAndUpdate(payload.sub, { refreshToken: null });
      } catch {
        // expired or invalid token — nothing to invalidate
      }
    }
    res.clearCookie("refreshToken", { ...refreshCookieOptions, maxAge: undefined });
    return res.json({ success: true, message: "Logged out" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const me = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("department team");
    return res.json({ success: true, message: "Profile fetched", data: { user } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
```

- [ ] **Step 4: Write src/routes/authRoutes.js**

```javascript
import { Router } from "express";

import { login, refresh, logout, me } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", authenticate, me);

export default router;
```

- [ ] **Step 5: Mount the router in src/app.js**

Add the import below the existing imports, and mount it between `cookieParser` and the health route:

```javascript
import authRoutes from "./routes/authRoutes.js";
```

```javascript
app.use("/api/auth", authRoutes);
```

(`app.use(errorHandler)` stays last.)

- [ ] **Step 6: Verify unauthenticated behavior**

```bash
cd /home/zaid/Projects/wos/backend && npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/api/auth/me
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5000/api/auth/refresh
```

Expected: `401` and `401`. (Login can't be tested yet — no users exist until Task 4.) Kill the server after.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: add jwt auth with rotating refresh tokens and rbac middleware"
```

---

### Task 4: Seed script (first admin)

**Files:**
- Create: `/home/zaid/Projects/wos/backend/scripts/seed.js`

**Interfaces:**
- Consumes: `User` model. Env: `MONGODB_URI`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.
- Produces: one admin user in the DB (idempotent — skips if any admin exists).

- [ ] **Step 1: Write scripts/seed.js**

```javascript
import mongoose from "mongoose";
import bcrypt from "bcrypt";

import User from "../src/models/User.js";

const seed = async () => {
  const { MONGODB_URI, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;
  if (!MONGODB_URI || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    console.error("MONGODB_URI, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required");
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  const existing = await User.findOne({ role: "admin" });
  if (existing) {
    console.log(`Admin already exists: ${existing.email}`);
  } else {
    await User.create({
      name: "Admin",
      email: SEED_ADMIN_EMAIL,
      password: await bcrypt.hash(SEED_ADMIN_PASSWORD, 10),
      role: "admin",
    });
    console.log(`Admin created: ${SEED_ADMIN_EMAIL}`);
  }
  await mongoose.disconnect();
};

seed().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run it (twice, to prove idempotence)**

```bash
cd /home/zaid/Projects/wos/backend
npm run seed
npm run seed
```

Expected: first run `Admin created: <email>`, second run `Admin already exists: <email>`.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed.js
git commit -m "feat: add admin seed script"
```

---

### Task 5: Auth smoke script

**Files:**
- Create: `/home/zaid/Projects/wos/backend/scripts/smoke-auth.js`

**Interfaces:**
- Consumes: running server + seeded admin. Env: `API_URL` (default `http://localhost:5000/api`), `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.

- [ ] **Step 1: Write scripts/smoke-auth.js**

```javascript
import assert from "node:assert";
import axios from "axios";

const BASE = process.env.API_URL || "http://localhost:5000/api";
const EMAIL = process.env.SEED_ADMIN_EMAIL;
const PASSWORD = process.env.SEED_ADMIN_PASSWORD;

const cookieOf = (response) =>
  response.headers["set-cookie"]?.find((c) => c.startsWith("refreshToken="))?.split(";")[0];

const run = async () => {
  const login = await axios.post(`${BASE}/auth/login`, { email: EMAIL, password: PASSWORD });
  assert.equal(login.data.success, true, "login succeeds");
  const accessToken = login.data.data.accessToken;
  assert.ok(accessToken, "access token returned");
  const cookie = cookieOf(login);
  assert.ok(cookie, "refresh cookie set");

  const badLogin = await axios.post(
    `${BASE}/auth/login`,
    { email: EMAIL, password: "definitely-wrong" },
    { validateStatus: () => true }
  );
  assert.equal(badLogin.status, 401, "wrong password rejected");

  const me = await axios.get(`${BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.equal(me.data.data.user.email, EMAIL, "me returns the logged-in user");

  const refresh = await axios.post(`${BASE}/auth/refresh`, {}, { headers: { Cookie: cookie } });
  assert.ok(refresh.data.data.accessToken, "refresh returns a new access token");
  const rotatedCookie = cookieOf(refresh);
  assert.ok(rotatedCookie, "refresh rotates the cookie");

  const staleRefresh = await axios.post(
    `${BASE}/auth/refresh`,
    {},
    { headers: { Cookie: cookie }, validateStatus: () => true }
  );
  assert.equal(staleRefresh.status, 401, "old refresh token rejected after rotation");

  const logout = await axios.post(`${BASE}/auth/logout`, {}, { headers: { Cookie: rotatedCookie } });
  assert.equal(logout.data.success, true, "logout succeeds");

  const afterLogout = await axios.post(
    `${BASE}/auth/refresh`,
    {},
    { headers: { Cookie: rotatedCookie }, validateStatus: () => true }
  );
  assert.equal(afterLogout.status, 401, "refresh rejected after logout");

  console.log("smoke-auth: all checks passed");
};

run().catch((error) => {
  console.error("smoke-auth failed:", error.message);
  process.exit(1);
});
```

- [ ] **Step 2: Run it against the live server**

```bash
cd /home/zaid/Projects/wos/backend && npm run dev &
sleep 3
node --env-file=.env scripts/smoke-auth.js
```

Expected: `smoke-auth: all checks passed`. Kill the server after.

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-auth.js
git commit -m "feat: add auth smoke script"
```

---

### Task 6: User management endpoints (admin-only) + smoke

**Files:**
- Create: `/home/zaid/Projects/wos/backend/src/validators/userValidators.js`
- Create: `/home/zaid/Projects/wos/backend/src/controllers/userController.js`
- Create: `/home/zaid/Projects/wos/backend/src/routes/userRoutes.js`
- Create: `/home/zaid/Projects/wos/backend/scripts/smoke-users.js`
- Modify: `/home/zaid/Projects/wos/backend/src/app.js`

**Interfaces:**
- Consumes: `authenticate`, `authorize` (Task 3), `User` model, `ROLES` constant.
- Produces: `POST /api/users` (201, `{data:{user}}`), `GET /api/users` (`{data:{users}}`), `PATCH /api/users/:id` (`{data:{user}}`) — all admin-only.

- [ ] **Step 1: Write src/validators/userValidators.js**

```javascript
import { ROLES } from "../constants/roles.constants.js";

export const validateCreateUser = (req, res, next) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res
      .status(400)
      .json({ success: false, message: "name, email, password and role are required" });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ success: false, message: "Invalid email" });
  }
  if (String(password).length < 8) {
    return res
      .status(400)
      .json({ success: false, message: "Password must be at least 8 characters" });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: "Invalid role" });
  }
  next();
};
```

- [ ] **Step 2: Write src/controllers/userController.js**

```javascript
import bcrypt from "bcrypt";

import User from "../models/User.js";

export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, designation, department, team, reportingManager } =
      req.body;
    const existing = await User.findOne({ email: String(email).toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: "Email already in use" });
    }
    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role,
      designation,
      department: department || null,
      team: team || null,
      reportingManager: reportingManager || null,
    });
    const safeUser = await User.findById(user._id);
    return res.status(201).json({ success: true, message: "User created", data: { user: safeUser } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const listUsers = async (req, res) => {
  try {
    const users = await User.find().populate("department team reportingManager", "name email");
    return res.json({ success: true, message: "Users fetched", data: { users } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const allowed = [
      "name",
      "designation",
      "role",
      "department",
      "team",
      "reportingManager",
      "isActive",
    ];
    const updates = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.json({ success: true, message: "User updated", data: { user } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};
```

- [ ] **Step 3: Write src/routes/userRoutes.js**

```javascript
import { Router } from "express";

import { createUser, listUsers, updateUser } from "../controllers/userController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validateCreateUser } from "../validators/userValidators.js";

const router = Router();

router.use(authenticate, authorize("admin"));
router.post("/", validateCreateUser, createUser);
router.get("/", listUsers);
router.patch("/:id", updateUser);

export default router;
```

- [ ] **Step 4: Mount in src/app.js**

Add the import and mount directly below the auth router:

```javascript
import userRoutes from "./routes/userRoutes.js";
```

```javascript
app.use("/api/users", userRoutes);
```

- [ ] **Step 5: Write scripts/smoke-users.js**

```javascript
import assert from "node:assert";
import axios from "axios";

const BASE = process.env.API_URL || "http://localhost:5000/api";
const EMAIL = process.env.SEED_ADMIN_EMAIL;
const PASSWORD = process.env.SEED_ADMIN_PASSWORD;

const run = async () => {
  const login = await axios.post(`${BASE}/auth/login`, { email: EMAIL, password: PASSWORD });
  const auth = { headers: { Authorization: `Bearer ${login.data.data.accessToken}` } };

  const memberEmail = `member+${Date.now()}@wos.local`;
  const created = await axios.post(
    `${BASE}/users`,
    { name: "Test Member", email: memberEmail, password: "memberpass123", role: "member" },
    auth
  );
  assert.equal(created.status, 201, "admin creates a user");

  const dup = await axios.post(
    `${BASE}/users`,
    { name: "Dup", email: memberEmail, password: "memberpass123", role: "member" },
    { ...auth, validateStatus: () => true }
  );
  assert.equal(dup.status, 409, "duplicate email rejected");

  const badRole = await axios.post(
    `${BASE}/users`,
    { name: "Bad", email: `bad+${Date.now()}@wos.local`, password: "memberpass123", role: "boss" },
    { ...auth, validateStatus: () => true }
  );
  assert.equal(badRole.status, 400, "invalid role rejected");

  const memberLogin = await axios.post(`${BASE}/auth/login`, {
    email: memberEmail,
    password: "memberpass123",
  });
  assert.equal(memberLogin.data.data.user.role, "member", "created member can log in");

  const forbidden = await axios.get(`${BASE}/users`, {
    headers: { Authorization: `Bearer ${memberLogin.data.data.accessToken}` },
    validateStatus: () => true,
  });
  assert.equal(forbidden.status, 403, "member cannot list users");

  const memberId = created.data.data.user._id;
  await axios.patch(`${BASE}/users/${memberId}`, { isActive: false }, auth);
  const inactiveLogin = await axios.post(
    `${BASE}/auth/login`,
    { email: memberEmail, password: "memberpass123" },
    { validateStatus: () => true }
  );
  assert.equal(inactiveLogin.status, 401, "deactivated user cannot log in");

  console.log("smoke-users: all checks passed");
};

run().catch((error) => {
  console.error("smoke-users failed:", error.response?.data?.message || error.message);
  process.exit(1);
});
```

- [ ] **Step 6: Run both smoke scripts**

```bash
cd /home/zaid/Projects/wos/backend && npm run dev &
sleep 3
npm run smoke
```

Expected: `smoke-auth: all checks passed` then `smoke-users: all checks passed`. Kill the server after.

- [ ] **Step 7: Commit**

```bash
git add src scripts
git commit -m "feat: add admin-only user management endpoints"
```

---

### Task 7: Backend Dockerfile

**Files:**
- Create: `/home/zaid/Projects/wos/backend/Dockerfile`
- Create: `/home/zaid/Projects/wos/backend/.dockerignore`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts
EXPOSE 5000
CMD ["node", "src/server.js"]
```

(`node:20-slim`, not alpine — bcrypt's native build needs glibc prebuilds. Env vars come from the container environment, not `--env-file`.)

- [ ] **Step 2: Write .dockerignore**

```text
node_modules
.env
.git
```

- [ ] **Step 3: Verify the image builds (skip if Docker unavailable)**

```bash
cd /home/zaid/Projects/wos/backend && docker build -t wos-backend .
```

Expected: build succeeds. If the Docker daemon isn't available, note it and move on — this is not a blocker for the slice.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "chore: add dockerfile"
```

---

### Task 8: Frontend dependencies, design tokens, Inter font

**Files:**
- Modify: `/home/zaid/Projects/wos/frontend/package.json` (via npm install)
- Modify: `/home/zaid/Projects/wos/frontend/app/globals.css` (full replace)
- Modify: `/home/zaid/Projects/wos/frontend/app/layout.js` (full replace)
- Create: `/home/zaid/Projects/wos/frontend/.env.local`

**Interfaces:**
- Produces: Tailwind utility classes later tasks depend on: `bg-background`, `bg-surface`, `border-border`, `text-primary`, `text-muted`, `text-danger`, `bg-primary`, `text-primary-foreground`, `rounded-card` (16px), `rounded-btn` (10px), `rounded-input` (10px). Env: `NEXT_PUBLIC_API_URL`.

- [ ] **Step 1: Install dependencies**

```bash
cd /home/zaid/Projects/wos
npm install axios zustand react-hook-form yup @hookform/resolvers lucide-react
```

- [ ] **Step 2: Create .env.local**

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

- [ ] **Step 3: Replace app/globals.css**

Warm monochrome palette (minimalist editorial), semantic tokens only — this file is the ONLY place hex values are allowed:

```css
@import "tailwindcss";

:root {
  --background: #faf9f7;
  --surface: #ffffff;
  --border: #e8e5e0;
  --primary: #1c1b19;
  --primary-foreground: #ffffff;
  --muted: #6f6b63;
  --success: #1f7a4d;
  --warning: #b45309;
  --danger: #b91c1c;
  --info: #1d4ed8;
}

@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-border: var(--border);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-danger: var(--danger);
  --color-info: var(--info);

  --radius-card: 16px;
  --radius-btn: 10px;
  --radius-input: 10px;
  --radius-dialog: 18px;
  --radius-dropdown: 12px;

  --font-sans: var(--font-inter), system-ui, sans-serif;
}

body {
  background: var(--background);
  color: var(--primary);
  font-family: var(--font-sans);
}
```

- [ ] **Step 4: Replace app/layout.js**

```javascript
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "WorkOS",
  description: "Internal team and project management platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Verify dev server compiles**

```bash
cd /home/zaid/Projects/wos/frontend && npm run dev &
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
```

Expected: `200`. Kill the dev server after.

- [ ] **Step 6: Commit**

```bash
cd /home/zaid/Projects/wos
git add package.json package-lock.json app/globals.css app/layout.js
git commit -m "feat: add design tokens, inter font and core frontend dependencies"
```

(`.env.local` is gitignored — do not commit it.)

---

### Task 9: Auth store, axios instance, auth service

**Files:**
- Create: `/home/zaid/Projects/wos/frontend/store/authStore.js`
- Create: `/home/zaid/Projects/wos/frontend/services/axiosInstance.js`
- Create: `/home/zaid/Projects/wos/frontend/services/authService.js`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_API_URL`; backend endpoints from Task 3.
- Produces: `useAuthStore` with `{user, accessToken, setAuth({user, accessToken}), setUser(user), setAccessToken(token), clearAuth()}`; default-export `axiosInstance`; `login(credentials)` → `{user, accessToken}`, `logout()`, `fetchMe()` → user.

- [ ] **Step 1: Write store/authStore.js**

```javascript
import { create } from "zustand";

export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  setAuth: ({ user, accessToken }) => set({ user, accessToken }),
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearAuth: () => set({ user: null, accessToken: null }),
}));
```

- [ ] **Step 2: Write services/axiosInstance.js**

Token lives in memory (Zustand) only. On 401 the interceptor tries one refresh (cookie-based), then retries the original request; concurrent 401s share one refresh call.

```javascript
import axios from "axios";

import { useAuthStore } from "@/store/authStore";

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const noRetry = ["/auth/login", "/auth/refresh", "/auth/logout"].some((path) =>
      original?.url?.includes(path)
    );
    if (error.response?.status !== 401 || original?._retried || noRetry) {
      return Promise.reject(error);
    }
    original._retried = true;
    try {
      refreshPromise =
        refreshPromise ||
        axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );
      const { data } = await refreshPromise;
      refreshPromise = null;
      const accessToken = data.data.accessToken;
      useAuthStore.getState().setAccessToken(accessToken);
      original.headers.Authorization = `Bearer ${accessToken}`;
      return axiosInstance(original);
    } catch (refreshError) {
      refreshPromise = null;
      useAuthStore.getState().clearAuth();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    }
  }
);

export default axiosInstance;
```

- [ ] **Step 3: Write services/authService.js**

```javascript
import axiosInstance from "./axiosInstance";

export const login = async (credentials) => {
  const { data } = await axiosInstance.post("/auth/login", credentials);
  return data.data;
};

export const logout = async () => {
  await axiosInstance.post("/auth/logout");
};

export const fetchMe = async () => {
  const { data } = await axiosInstance.get("/auth/me");
  return data.data.user;
};
```

- [ ] **Step 4: Verify the app still compiles**

```bash
cd /home/zaid/Projects/wos/frontend && npm run build
```

Expected: build succeeds (files aren't imported by any page yet, but must parse).

- [ ] **Step 5: Commit**

```bash
git add store services
git commit -m "feat: add auth store, axios instance with refresh interceptor and auth service"
```

---

### Task 10: Login page

**Files:**
- Create: `/home/zaid/Projects/wos/frontend/app/login/page.js`

**Interfaces:**
- Consumes: `login` from `@/services/authService`, `useAuthStore.setAuth`.
- Produces: `/login` route; on success navigates to `/dashboard`.

- [ ] **Step 1: Write app/login/page.js**

```javascript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { useAuthStore } from "@/store/authStore";
import { login } from "@/services/authService";

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
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">WorkOS</h1>
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

          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
              className="mt-1 w-full rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
            />
            {errors.email && <p className="mt-1 text-sm text-danger">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
              className="mt-1 w-full rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-danger">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-btn bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Start the backend (`cd /home/zaid/Projects/wos/backend && npm run dev`) and frontend (`cd /home/zaid/Projects/wos/frontend && npm run dev`). Open `http://localhost:3000/login`:

- Empty submit → inline "Email is required" / "Password is required" below inputs.
- Wrong password → "Invalid credentials" banner.
- Correct seed admin credentials → navigates to `/dashboard` (404 for now — the route lands in Task 12; the navigation itself is what's being verified).

- [ ] **Step 3: Commit**

```bash
git add app/login
git commit -m "feat: add login page with react hook form and yup validation"
```

---

### Task 11: App shell — nav constants, Sidebar, Header, authenticated layout

**Files:**
- Create: `/home/zaid/Projects/wos/frontend/constants/nav.constants.js`
- Create: `/home/zaid/Projects/wos/frontend/components/layout/Sidebar.jsx`
- Create: `/home/zaid/Projects/wos/frontend/components/layout/Header.jsx`
- Create: `/home/zaid/Projects/wos/frontend/app/(app)/layout.js`

**Interfaces:**
- Consumes: `useAuthStore`, `fetchMe`, `logout` (Tasks 9); design token classes (Task 8).
- Produces: route group `(app)` — every page inside it is auth-guarded and rendered inside Sidebar+Header shell. `NAV_ITEMS` array of `{href, label, icon}`.

- [ ] **Step 1: Write constants/nav.constants.js**

```javascript
import {
  LayoutDashboard,
  Calendar,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  Users,
  Bell,
  Settings,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/follow-ups", label: "Follow-ups", icon: MessageSquare },
  { href: "/team", label: "Team", icon: Users },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];
```

(Only `/dashboard` exists in this slice; the other links 404 until their slices land — deliberate.)

- [ ] **Step 2: Write components/layout/Sidebar.jsx**

280px expanded / 80px collapsed (`w-70` = 280px, `w-20` = 80px on Tailwind's 4px scale), 200ms width collapse, active item gets a left indicator bar + background highlight per DESIGN.md:

```javascript
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { NAV_ITEMS } from "@/constants/nav.constants";

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 ease-out ${
        collapsed ? "w-20" : "w-70"
      }`}
    >
      <div className={`flex h-16 items-center border-b border-border px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && <span className="text-lg font-semibold tracking-tight">WorkOS</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-btn p-2 text-muted transition-colors duration-150 hover:bg-background hover:text-primary"
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={`relative flex items-center gap-3 rounded-btn px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                collapsed ? "justify-center" : ""
              } ${
                active
                  ? "bg-background text-primary"
                  : "text-muted hover:bg-background hover:text-primary"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
              )}
              <Icon size={20} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Write components/layout/Header.jsx**

```javascript
"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { NAV_ITEMS } from "@/constants/nav.constants";
import { useAuthStore } from "@/store/authStore";
import { logout } from "@/services/authService";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const title = NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.label || "WorkOS";

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // clear the local session regardless of API failure
    }
    clearAuth();
    router.replace("/login");
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-8">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs capitalize text-muted">{user?.role}</p>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Log out"
          className="rounded-btn p-2 text-muted transition-colors duration-150 hover:bg-background hover:text-primary"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
```

(Search, notifications and org switcher from DESIGN.md's header are placeholders for later slices — added when their modules land.)

- [ ] **Step 4: Write app/(app)/layout.js**

Auth guard: if no user in store, try `fetchMe()` — the axios interceptor transparently refreshes via cookie, so a page reload stays logged in. Failure redirects to `/login`.

```javascript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { useAuthStore } from "@/store/authStore";
import { fetchMe } from "@/services/authService";

export default function AppLayout({ children }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [checking, setChecking] = useState(!user);

  useEffect(() => {
    if (user) return;
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (!cancelled) {
          setUser(me);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [user, setUser, router]);

  if (checking && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-40 animate-pulse rounded-btn bg-border" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify compile**

```bash
cd /home/zaid/Projects/wos/frontend && npm run build
```

Expected: build succeeds. (Browser verification comes with Task 12 when a page exists inside the group.)

- [ ] **Step 6: Commit**

```bash
git add constants components "app/(app)"
git commit -m "feat: add authenticated app shell with collapsible sidebar and header"
```

---

### Task 12: Dashboard placeholder + root redirect

**Files:**
- Create: `/home/zaid/Projects/wos/frontend/app/(app)/dashboard/page.js`
- Modify: `/home/zaid/Projects/wos/frontend/app/page.js` (full replace)

**Interfaces:**
- Consumes: `useAuthStore` user; app shell from Task 11.
- Produces: `/dashboard` route; `/` redirects to `/dashboard` (which bounces to `/login` when unauthenticated).

- [ ] **Step 1: Write app/(app)/dashboard/page.js**

```javascript
"use client";

import { useAuthStore } from "@/store/authStore";

const ROLE_HEADLINES = {
  admin: "Organization overview",
  manager: "Your team today",
  sublead: "Your projects today",
  member: "Your day at a glance",
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="mx-auto max-w-[1600px]">
      <p className="text-sm text-muted">Welcome back,</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{user?.name}</h2>

      <div className="mt-8 rounded-card border border-border bg-surface p-6">
        <p className="text-sm font-medium capitalize text-muted">{user?.role} dashboard</p>
        <p className="mt-2 text-lg font-medium">{ROLE_HEADLINES[user?.role] || "Dashboard"}</p>
        <p className="mt-1 text-sm text-muted">
          Widgets land in the next slice. Auth, roles and the app shell are live.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace app/page.js**

```javascript
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 3: Verify build**

```bash
cd /home/zaid/Projects/wos/frontend && npm run build
```

Expected: build succeeds with `/dashboard` and `/login` in the route list.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/dashboard" app/page.js
git commit -m "feat: add role-aware dashboard placeholder and root redirect"
```

---

### Task 13: End-to-end verification (spec success criteria)

**Files:** none — verification only.

- [ ] **Step 1: Backend checks**

```bash
cd /home/zaid/Projects/wos/backend && npm run dev &
sleep 3
npm run seed
npm run smoke
```

Expected: seed reports the admin exists; both smoke scripts pass. (Spec criteria 1 and 3.)

- [ ] **Step 2: Browser flow (backend still running)**

```bash
cd /home/zaid/Projects/wos/frontend && npm run dev
```

Manually verify, in order:

1. `http://localhost:3000/` → redirected to `/dashboard` → bounced to `/login` (no session).
2. Log in with seed admin credentials → dashboard shows "Admin" name, "admin dashboard", "Organization overview".
3. Hard-reload `/dashboard` → brief skeleton, then still logged in (refresh-cookie bootstrap — spec criterion 2).
4. Collapse/expand sidebar → smooth 200ms width animation, icons stay aligned.
5. Log out via header → back at `/login`; hard-reload `/dashboard` → bounced to `/login` (session invalidated).
6. Create a member via API, then log in as them and confirm the member headline ("Your day at a glance"):

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$SEED_ADMIN_EMAIL\",\"password\":\"$SEED_ADMIN_PASSWORD\"}" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.accessToken))")
curl -s -X POST http://localhost:5000/api/users -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"Demo Member","email":"demo@wos.local","password":"demopass123","role":"member"}'
```

- [ ] **Step 3: Token/design spot-check (spec criterion 4)**

Confirm no raw hex outside `app/globals.css`:

```bash
cd /home/zaid/Projects/wos/frontend && grep -rn "#[0-9a-fA-F]\{3,6\}" app components --include="*.js" --include="*.jsx" | grep -v globals.css
```

Expected: no output.

- [ ] **Step 4: Lint both repos, fix anything reported**

```bash
cd /home/zaid/Projects/wos/frontend && npm run lint
```

Expected: clean (or only pre-existing boilerplate warnings).

---

## Deliberately deferred (do not build in this slice)

- Department/Team CRUD UI, TanStack Query provider (first data-listing page adds it), toasts (Module 12), password reset (needs email infra), dark mode toggle, Ctrl+K search, rate limiting, docker-compose (single service now), placeholder pages for non-dashboard nav routes.
