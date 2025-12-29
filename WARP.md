# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Core commands

All commands are run from the repo root.

### Install dependencies
- Install Node dependencies (use Node 20+ to match the Docker image):
  - `npm ci` (preferred when `package-lock.json` is present)
  - or `npm install`

### Application lifecycle
- **Start in dev (direct, no Docker):**
  - Ensure `DATABASE_URL` points at a reachable Postgres instance.
  - `npm run dev` → starts `src/index.js` with `node --watch`.
- **Start in dev with Docker + local Postgres (recommended):**
  - Create `.env.development` (see comments in `scripts/dev.sh` and `docker-compose.dev.yml`) with at least:
    - `DATABASE_URL` for the local Postgres container
    - `JWT_SECRET` (used by `src/utils/jwt.js`)
    - `ARCJET_KEY` (used by `src/config/arcjet.js`)
  - `npm run dev:docker` →
    - Verifies `.env.development` exists and Docker is running.
    - Brings up Postgres via `docker-compose.dev.yml`.
    - Waits for Postgres readiness.
    - Runs `npm run db:migrate`.
    - Starts app + Postgres via `docker-compose.dev.yml`.
- **Start in production-like mode (no watch):**
  - `npm start` → runs `node src/index.js`.
  - In the Docker image, startup runs `npx drizzle-kit push --force && npm start` to sync schema before starting.

### Database (Drizzle + Postgres)
- Config: `drizzle.config.js` (schema from `src/models/*.js`, output to `drizzle/`).
- Commands:
  - Generate migrations from models: `npm run db:generate`
  - Apply migrations: `npm run db:migrate`
  - Open Drizzle Studio: `npm run db:studio`

### Linting and formatting
- Lint all JS (flat config in `eslint.config.js`): `npm run lint`
- Auto-fix lint issues: `npm run lint:fix`
- Format with Prettier: `npm run format`
- Check formatting only: `npm run format:check`

### Tests (Jest, ESM)
- Run the full test suite:
  - `npm test`
- Run a single test file (preferred pattern):
  - `npm test -- --testPathPattern=auth.controller.test.js`
- Notes:
  - Jest config is in `jest.config.cjs` (`testEnvironment: 'node'`).
  - Module aliases like `#services/*` map to `src/services/*` via `moduleNameMapper`.
  - Tests (e.g. `tests/auth.controller.test.js`) use `jest.unstable_mockModule` to mock ESM modules by their `#` aliases; follow this pattern for new tests that need to mock internal modules.

## High-level architecture

### Runtime entrypoints
- `src/index.js`
  - Loads environment variables via `dotenv/config`.
  - Imports and runs `./server.js`.
- `src/server.js`
  - Imports the configured Express app from `./app.js`.
  - Reads `PORT` from `process.env.PORT || 3000`.
  - Starts the HTTP server and logs the listening URL.

### HTTP application and routing
- `src/app.js` is the central Express app configuration:
  - Global middleware:
    - `helmet` for basic security headers.
    - `cors` for CORS support.
    - `express.json` / `express.urlencoded` for body parsing.
    - `cookie-parser` for cookie access.
    - `morgan` HTTP logging piped into the shared Winston logger (`#config/logger.js`).
    - `securityMiddleware` from `#middleware/security.middleware.js` (Arcjet-based security & rate limiting) applied globally before routes.
  - Health & root routes:
    - `GET /` → plain text "Hello from Acquisition!" and log line.
    - `GET /health` → JSON health payload with `status`, `timestamp`, and `uptime`.
    - `GET /api` → basic JSON heartbeat.
  - API route mounting:
    - `app.use('/api/auth', authRoutes)` → `src/routes/auth.routes.js`.
    - `app.use('/api/users', usersRoutes)` → `src/routes/users.routes.js`.

### Route → controller → service → database flow

The backend is structured into distinct layers, wired together using Node `imports` aliases defined in `package.json` (`"#config/*"`, `"#controllers/*"`, `"#services/*"`, etc.) and mirrored in `jest.config.cjs`.

- **Routes (`src/routes/`)**
  - `auth.routes.js`:
    - `POST /api/auth/sign-up` → `signup` in `#controllers/auth.controller.js`.
    - `POST /api/auth/sign-in` → `signin` in `#controllers/auth.controller.js`.
    - `POST /api/auth/sign-out` → `signout` in `#controllers/auth.controller.js`.
  - `users.routes.js`:
    - Intended to expose `/api/users`-scoped endpoints and currently wires `fetchAllUsers` from `#controllers/users.controller.js` to `GET /api/users`.

- **Controllers (`src/controllers/`)**
  - `auth.controller.js`:
    - Validates request bodies with Zod schemas from `#validations/auth.validation.js` (`signupSchema`, `signinSchema`).
    - On validation failure, responds with HTTP 400 and error details produced by `formatValidationError` from `#utils/format.js`.
    - Delegates to auth services from `#services/auth.service.js`:
      - `creatUser` (user creation + uniqueness check).
      - `authenticateUser` (lookup + password verification).
    - Uses the `jwttoken` helper from `#utils/jwt.js` to sign JWT payloads.
    - Uses the `cookies` helper from `#utils/cookies.js` to set a secure `token` cookie.
    - Logs all significant events (signup/signin/signout) via `#config/logger.js`.
    - Auth error handling:
      - Conflicts (`USER_EXISTS` or matching message) → HTTP 409 `Email already exists`.
      - Auth failures (`USER_NOT_FOUND`, `INVALID_CREDENTIALS`) → HTTP 401 with a generic message, logged as warnings (not hard errors).
  - `users.controller.js`:
    - `fetchAllUsers` logs via the shared logger, calls `getAllUsers` in `#services/users.services.js`, and returns a JSON payload with `users` and `count`.

- **Services (`src/services/`)**
  - `auth.service.js`:
    - Depends on `#config/database.js` (`db` instance) and Drizzle models from `#models/user.model.js`.
    - Password helpers:
      - `hashPassword` / `comparePassword` wrap `bcrypt` and log on failure.
    - `authenticateUser(email, password)`:
      - Queries the `users` table by email via Drizzle.
      - If no user, throws an error with `code = 'USER_NOT_FOUND'`.
      - If password mismatch, throws `code = 'INVALID_CREDENTIALS'`.
      - Strips the `password` field before returning the user object.
    - `creatUser({ name, email, password, role })`:
      - Checks for existing user by email and throws `code = 'USER_EXISTS'` when found.
      - Hashes the password and inserts a new user row.
      - Returns a safe subset of user fields (no password) and logs success.
  - `users.services.js`:
    - Uses `db` from `#config/database.js` and `users` table from `#models/schema.js`.
    - `getAllUsers` performs a simple `select().from(users)` and strips the `password` field from each returned record.

- **Models (`src/models/`)**
  - Drizzle schema definitions for the `users` table:
    - `schema.js` and `user.model.js` both define a `users` table for Drizzle, with slightly different timestamp column naming (`createdAt/updatedAt` vs `created_at/updated_at`).
    - `drizzle.config.js` uses glob `./src/models/*.js`, so both definitions participate in schema generation; be aware of this when evolving the data model.

### Configuration and environment

- **Environment loading**
  - `dotenv/config` is imported in `src/index.js` and `src/config/database.js` so `.env`-style files are loaded early.
  - The `scripts/dev.sh` script expects `.env.development` for local Docker-based development.

- **Key environment variables used in code**
  - `DATABASE_URL`:
    - Used by `src/config/database.js` for both local postgres-js and Neon connections.
    - Must match the Postgres connection string used in `docker-compose.dev.yml` for local dev.
  - `NODE_ENV`:
    - Controls DB connection mode in `src/config/database.js` (`development` → local postgres-js, anything else → Neon serverless via `@neondatabase/serverless`).
    - Controls logger behavior in `src/config/logger.js` (console logging only when not `production`).
    - Influences secure cookie flags in `src/utils/cookies.js` (`secure: NODE_ENV === 'production'`).
  - `LOG_LEVEL`:
    - Optional; used by `src/config/logger.js` to set the Winston log level (defaults to `info`).
  - `JWT_SECRET`:
    - Used by `src/utils/jwt.js` for signing/verifying JWTs.
    - Defaults to a development-only string if not set; should be overridden in real deployments.
  - `ARCJET_KEY`:
    - Used by `src/config/arcjet.js` to initialize the Arcjet client.

- **Logging (`src/config/logger.js`)**
  - Central Winston logger instance exported as the default from `#config/logger.js`.
  - Writes to `logs/error.lg` (errors) and `logs/combined.log` (info and above).
  - Adds a colorized console transport when `NODE_ENV !== 'production'`.
  - Used across services, controllers, and middleware for structured logging.

### Security and rate limiting

- **Arcjet configuration (`src/config/arcjet.js`)**
  - Initializes Arcjet with a set of rules:
    - `shield({ mode: 'LIVE' })` as a general protection layer.
    - `detectBot` to detect and optionally allow specific bot categories (e.g., search engines and link preview bots).
    - A base `slidingWindow` rule (2s interval, max 5) used as a baseline rate limit.

- **Security middleware (`src/middleware/security.middleware.js`)**
  - Wraps Arcjet with dynamic per-role rate limiting by calling `aj.withRule(slidingWindow(...))` on each request.
  - Role is derived from `req.user?.role` (falls back to `'guest'`):
    - `admin` → higher limit (20/minute).
    - `user` → medium limit (10/minute).
    - `guest` (default) → strict limit (5/minute).
  - Examines the Arcjet `decision` result:
    - Bot traffic → HTTP 403 with a specific bot-related message and a warning log.
    - Shield violations → HTTP 403 with a generic security policy message.
    - Rate limit exceeded → HTTP 429 with a role-specific message.
  - On unexpected errors, logs and returns HTTP 500 with a generic security middleware error payload.

### Validation and utilities

- **Validation (`src/validations/auth.validation.js`)**
  - Uses Zod schemas for auth payloads:
    - `signupSchema` → `name`, `email`, `password`, `role` (`'user' | 'admin'`).
    - `signinSchema` → `email`, `password`.
  - Controllers use `safeParse` and, on failure, format errors via `formatValidationError` and return HTTP 400.

- **Utility modules (`src/utils/`)**
  - `format.js`:
    - `formatValidationError(errors)` converts Zod error objects into a human-readable comma-separated message string.
  - `jwt.js`:
    - `jwttoken.sign(payload)` and `jwttoken.verify(token)` wrap `jsonwebtoken` with shared config and centralized error logging.
  - `cookies.js`:
    - Encapsulates cookie options (`httpOnly`, `secure`, `sameSite: 'strict'`, `maxAge` 15 minutes) and exposes `set`, `clear`, and `get` helpers.
    - Ensures consistent security-related cookie configuration throughout the app.

### Testing approach

- Tests live under `tests/` and are plain `.js` files executed by Jest in Node ESM mode.
- `tests/auth.controller.test.js` demonstrates the preferred pattern for controller tests:
  - Use `jest.unstable_mockModule` to mock service, utility, and logger modules that are imported via `#` aliases.
  - Import the controller module **after** setting up the mocks so it sees the mocked implementations.
  - Use factory helpers (e.g., `createMockRes`) to build mock `res` objects supporting `status`, `json`, `cookie`, and `clearCookie` chaining.
- When adding new tests, follow this pattern to keep mocks and imports working correctly with ESM and the existing alias configuration.
