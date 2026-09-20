# EduPath

EduPath is an adaptive, AI-assisted learning platform that turns a learner's target role and declared skills into a personalized plan—and then verifies progress with assessments. The learning path changes as demonstrated mastery changes.

The central product rule is simple: AI creates questions, explanations, and missions; deterministic domain rules decide skills, levels, status, and replanning.

## What it does

- Builds a learner profile with target role, available time, declared skills, and tutor preferences.
- Maps role requirements to skill gaps, prerequisites, and priorities.
- Produces a weekly **Journey** of resources, practice, and projects from a curated catalog.
- Tracks activity progress without inflating skill levels.
- Generates independent assessments with three multiple-choice and two short-answer questions.
- Updates verified level and skill status deterministically after assessment.
- Replans when a level, status, unlock, or difficulty signal changes the learner's path.

## Product flow

```text
Profile → Skill gaps → Weekly Journey → Activities → Assessment
                                              ↓
                    Adaptive replanning ← Skill State update
```

## Architecture

| Area | Responsibility |
| --- | --- |
| `domain/` | Pure deterministic rules; no database, network, or model access. |
| `agents/` | Structured Gemini prompts, schemas, fixtures, and runners. |
| `services/` | Orchestrates domain, agents, and persistence. |
| `lib/db/repositories/` | Server-side Supabase access and persistence contracts. |
| `app/api/` | Thin Next.js App Router handlers. |
| `data/seed/` | Curated roles, skills, prerequisites, and resources. |
| `data/fixtures/` | Deterministic AI responses for local development and tests. |
| `supabase/migrations/` | PostgreSQL schema and transactional database functions. |

## Assessment safety and consistency

Assessment scoring is deterministic: correct multiple-choice answers count as `1`, short-answer scores come from the auditor agent, and the final score is the average of five questions. Only the domain layer can change a Skill State.

Submission persistence is atomic. A single database transaction updates the assessed skill, any unlocked dependents, and the graded assessment record. If any write fails, PostgreSQL rolls back the complete submission.

## Quick start

### Prerequisites

- Node.js 20 or later
- A Supabase project with service-role access
- A Gemini API key only when using `AI_MODE=live`

### Install and configure

```bash
cd edupath
npm install
cp .env.example .env.local
```

Configure `.env.local`:

```dotenv
AI_MODE="fixtures"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
GEMINI_API_KEY="your-key" # required only for AI_MODE=live
```

`fixtures` mode is the recommended default for local development: it avoids external model calls while retaining schema validation.

### Database setup

Apply every SQL file in `supabase/migrations/` to your Supabase database in lexical order. Then seed the catalog:

```bash
npm run seed
```

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The health endpoint is available at `/api/health`.

## Useful commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Build the production application. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm run test` | Run the Vitest suite. |
| `npm run seed` | Seed the curated catalog idempotently. |
| `npm run seed:check-urls` | Verify seeded resource URLs. |

To run the assessment-focused checks:

```bash
npx vitest run tests/domain/assessment.test.ts tests/api/assessments.test.ts tests/services/assessment.test.ts
```

## Key API routes

| Route | Purpose |
| --- | --- |
| `POST /api/onboarding` | Create the learner profile and initial skill states. |
| `GET /api/gaps` | Return deterministic gap analysis and explanation. |
| `POST /api/journey/generate` | Generate the first learning Journey. |
| `GET /api/journey` | Retrieve the active Journey. |
| `POST /api/assessments` | Generate or reuse an eligible assessment. |
| `GET /api/assessments/:id` | Retrieve questions or a graded result. |
| `POST /api/assessments/:id/submit` | Grade answers and apply the atomic Skill State update. |
| `POST /api/journey/replan` | Create a new Journey version after a valid trigger. |

## Design principles

- **Deterministic state:** models never decide a learner's level or status.
- **Independent assessment:** the assessment agent is separate from the friendly tutor.
- **Transparent adaptation:** plan changes are computed and explained.
- **Curated resources:** models do not invent URLs.
- **Safe retries:** grading failures leave learner state unchanged.

## Documentation

- [Product vision](docs/PRODUCT.md)
- [Specifications](docs/specs/README.md)
- [SPEC-004: Assessment and replanning](docs/specs/SPEC-004-assessment-replanning.md)
- [Environment template](.env.example)

## Security notes

Never commit `.env.local`, Supabase service-role keys, or Gemini keys. The Supabase client is server-side only; do not import it into browser components.

## License

This repository does not currently declare a license.
