# Acquisitions API

Acquisitions is a Node.js/Express backend for user authentication and user management, built with Postgres and Drizzle ORM and secured with Arcjet.

## Features

- Express-based HTTP API
- JWT authentication with secure HTTP-only cookies
- User sign-up, sign-in and sign-out flows
- Users listing endpoint
- Postgres database access via Drizzle ORM
- Centralized logging with Winston + HTTP request logging via morgan
- Security headers via helmet and CORS support
- Arcjet-powered security middleware and rate limiting
- Zod-based request validation
- Jest test setup

## Tech stack

- Node.js (ESM)
- Express 5
- Postgres 16
- Drizzle ORM
- Arcjet
- Zod
- Jest

## Getting started

### Prerequisites

- Node.js 20+
- Docker and Docker Compose (recommended for local Postgres)

### Installation

```bash
npm ci
# or
npm install
```

### Environment variables

Create a `.env.development` file in the project root with at least:

- `DATABASE_URL` – Postgres connection string
- `JWT_SECRET` – secret key for signing JWTs
- `ARCJET_KEY` – Arcjet API key

You can also set `NODE_ENV`, `LOG_LEVEL`, and `PORT` as needed.

## Running the app

### Development (Node only)

```bash
npm run dev
```

This starts the server with `node --watch` on `src/index.js` (default port 3000).

### Development with Docker (recommended)

```bash
npm run dev:docker
```

This will:

- Ensure `.env.development` exists
- Start Postgres using `docker-compose.dev.yml`
- Run database migrations
- Start the app container and expose the API on `http://localhost:3000`

### Production-like

```bash
npm start
```

Runs `node src/index.js` without file watching.

## API overview

Base URL (default): `http://localhost:3000`

### Health

- `GET /` – basic text response (service check)
- `GET /health` – JSON health payload
- `GET /api` – JSON API heartbeat

### Auth routes

Mounted under `/api/auth`:

- `POST /api/auth/sign-up` – user registration
- `POST /api/auth/sign-in` – login, returns JWT in an HTTP-only cookie
- `POST /api/auth/sign-out` – logout, clears auth cookie

### User routes

Mounted under `/api/users`:

- `GET /api/users` – fetch all users (auth and rate limiting rules apply)

## Database

Drizzle ORM is used for schema management and migrations.

Common commands:

```bash
npm run db:generate  # generate migrations from models
npm run db:migrate   # apply pending migrations
npm run db:studio    # open Drizzle Studio
```

The default local Postgres configuration for Docker is:

- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Password: `postgres`
- Database: `acquisitions`

## Testing

Jest is configured with Node test environment and ESM support.

Run all tests:

```bash
npm test
```

You can use `--testPathPattern` to run specific tests if desired.

## Linting & formatting

```bash
npm run lint        # run ESLint
npm run lint:fix    # run ESLint with auto-fix
npm run format      # format with Prettier
npm run format:check # check formatting without writing
```

## Project scripts

From `package.json`:

- `dev` – `node --watch src/index.js`
- `start` – `node src/index.js`
- `lint` – `eslint .`
- `lint:fix` – `eslint . --fix`
- `format` – `prettier --write .`
- `format:check` – `prettier --check .`
- `db:generate` – `drizzle-kit generate`
- `db:migrate` – `drizzle-kit migrate`
- `db:studio` – `drizzle-kit studio`
- `dev:docker` – `sh ./scripts/dev.sh`
- `test` – `NODE_OPTIONS=--experimental-vm-modules jest`

## License

ISC
