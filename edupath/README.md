# EduPath

EduPath is an AI-powered personalized learning platform.

This repository implements the foundation (SPEC-000), including database schema, seed catalog, AI abstraction layer with fixtures support, pure domain prerequisite graph validation, health check, and demo reset capabilities.

## Architecture

- `domain/`: Pure deterministic business rules (cycle detection, constants). No I/O, no DB, no LLM.
- `agents/`: AI agent definitions (prompts, schemas, execution wrappers).
- `services/`: Orchestration between domain, agents, and repositories.
- `lib/db/`: Server-side Supabase client and repositories (`roles`, `skills`, `learners`, `seed`).
- `lib/gemini/`: Gemini integration isolated using `@google/genai` (fixtures mode, retries, `AgentOutputError`).
- `app/api/`: Thin Next.js App Router HTTP handlers (`/api/health`, `/api/demo/reset`).
- `data/`:
  - `data/seed/`: Foundational reference catalog (roles, skills, prerequisites, verified resources).
  - `data/fixtures/`: Deterministic test fixtures for `AI_MODE=fixtures`.
- `supabase/migrations/`: Complete PostgreSQL schema (16 tables).
- `scripts/`:
  - `seed.ts`: Idempotent database seeder with prerequisite DAG pre-validation.
  - `check-urls.ts`: Live HTTP resource URL verifier.

## Getting Started

### 1. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Configure your environment variables:
- `GEMINI_API_KEY`: Google Gemini API key (server-side only)
- `GEMINI_MODEL`: Model name (default: `gemini-2.0-flash`)
- `AI_MODE`: `"fixtures"` (offline/mock) or `"live"` (Gemini API calls)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (server-side only)
- `DEMO_MODE`: Set to `"true"` to enable `/api/demo/reset`

### 2. Run Database Migration & Seed

Apply the initial schema on Supabase:
`supabase/migrations/00000000000000_initial_schema.sql`

Run the idempotent seed script:
```bash
npm run seed
```

### 3. Verify Resource URLs

Verify that all seed resource URLs respond with HTTP 200:
```bash
npm run seed:check-urls
```

### 4. Development Server

Start Next.js in development mode:
```bash
npm run dev
```

Visit:
- Home: `http://localhost:3000`
- Health Endpoint: `http://localhost:3000/api/health`

## Scripts

- `npm run dev`: Start development server
- `npm run build`: Build production Next.js bundle
- `npm run typecheck`: Run TypeScript type checker (`tsc --noEmit`)
- `npm run lint`: Run ESLint flat config (`eslint .`)
- `npm run test`: Run Vitest unit & API tests
- `npm run seed`: Run database seeder (validates prerequisite DAG before inserting)
- `npm run seed:check-urls`: Verify all 22 seed resource URLs via live HTTP requests
