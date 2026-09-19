# SPEC-000: Foundation, data and deployment

- **Status:** pending
- **Priority:** P0
- **Depends on:** nothing
- **Read first:** `/docs/PRODUCT.md`, `/docs/specs/README.md`

## 1. Objective

Leave a project **deployed and connected end to end** (Vercel, Supabase, Gemini) with the data schema, the seed for one role and the AI layer ready, so that the other specs are built on top of it without infrastructure surprises.

## 2. Scope

**Includes**

- Next.js (App Router) + TypeScript + Tailwind project, with scripts `dev`, `build`, `typecheck`, `lint` and `test` (Vitest).
- Folder structure from `specs/README.md` (section 4), with empty files or placeholders where appropriate.
- SQL migration with the schema from section 4.
- Seed of the catalog for one role (section 5).
- `lib/gemini` layer (section 6) and `lib/db` with minimal repositories.
- Route `GET /api/health` and a home page that demonstrates it.
- `POST /api/demo/reset`.
- Deployment on Vercel from GitHub with the environment variables configured.
- `.env.example` and a repository `README.md` with startup instructions.

**Does not include**

- Authentication, multi-user or Row Level Security with per-user policies.
- pgvector, RAG, queues or scheduled tasks.
- Any product screen (onboarding, dashboard, etc.).

## 3. Design

### 3.1 Layers

The cross-cutting rules of `specs/README.md` apply: pure `domain/`, `agents/` without data access, `services/` that orchestrate, `lib/` for integrations and thin API routes.

### 3.2 Single learner

The system has one active learner. `getActiveLearner()` returns the existing learner or `null`. There are no sessions or user cookies.

## 4. Data schema (first version)

Conventions: `id` is `uuid` with a default value, `created_at` is `timestamptz` with default value `now()`. Enumerations as `text` with a `check` constraint.

| Table | Main columns |
|---|---|
| `roles` | `id`, `slug` (unique), `name`, `description` |
| `skills` | `id`, `slug` (unique), `name`, `description`, `category` |
| `role_skills` | `role_id`, `skill_id`, `required_level` (0–4), `weight` (1–5). Composite primary key |
| `skill_prerequisites` | `skill_id`, `prerequisite_skill_id`. Composite primary key; no cycles |
| `resources` | `id`, `skill_id`, `title`, `url`, `type` (`course`, `video`, `article`, `docs`, `project`, `practice`), `level_min`, `level_max`, `language`, `verified` (boolean) |
| `learners` | `id`, `name`, `target_role_id`, `background` (text), `weekly_hours` (int), `extra_skills` (jsonb: informational list of `{name, level}`), `created_at` |
| `tutor_styles` | `learner_id` (PK and FK), `language`, `tone` (`formal`, `cercano`, `motivador`), `detail_level` (`resumido`, `equilibrado`, `profundo`), `use_analogies` (boolean), `free_instructions` (text) |
| `learner_skills` | `learner_id`, `skill_id`, `level` (0–4), `verification` (`self_reported`, `verified`), `status` (`locked`, `available`, `in_progress`, `acquired`, `struggling`), `progress` (0–100), `consecutive_failures` (int), `updated_at`. Primary key `(learner_id, skill_id)` |
| `objectives` | `id`, `learner_id`, `skill_id`, `description`, `mastery_criteria` (jsonb: list of texts), `target_level`, `status` (`active`, `done`, `dropped`), `created_at` |
| `journeys` | `id`, `learner_id`, `version` (int), `is_current` (boolean), `reason` (`initial`, `assessment`, `skipped_activities`, `profile_change`), `summary` (text), `changes` (jsonb), `created_at` |
| `activities` | `id`, `journey_id`, `objective_id`, `skill_id`, `week` (int), `type` (`resource`, `practice`, `project`), `title`, `mission` (text), `instructions` (text), `success_criteria` (text), `resource_id` (nullable), `estimated_minutes`, `status` (`pending`, `done`, `skipped`), `completed_at` |
| `assessments` | `id`, `learner_id`, `skill_id`, `kind` (`verification`, `progress`), `target_level`, `questions` (jsonb, with keys and rubrics), `answers` (jsonb), `score` (numeric, nullable), `measured_level` (nullable), `passed` (nullable), `feedback` (jsonb), `status` (`generated`, `graded`), `created_at`, `graded_at` |
| `gap_analyses` | `id`, `learner_id`, `input_hash`, `result` (jsonb), `created_at`. Cache of Gap Analysis Agent explanations |
| `reports` | `id`, `learner_id`, `data` (jsonb), `narrative` (jsonb), `created_at` |
| `notebooks` | `id`, `learner_id`, `title`, `content` (text), `created_at` |
| `notebook_skills` | `notebook_id`, `skill_id`. Composite primary key |

The `reports`, `notebooks` and `notebook_skills` tables are created here, but are used in SPEC-005.

## 5. Seed

Files in `data/seed/`:

- **Default role:** "Data Analyst (junior)". It is an editable example: if the team chooses another role, the content is replaced keeping the same structure.
- **Skills:** between 10 and 14. Suggestion: SQL, spreadsheets, descriptive statistics, probability, basic Python, pandas, data cleaning, data visualization, communicating results, relational modeling, basic Git.
- Each skill with `required_level` and `weight` for the role, and coherent prerequisites (for example pandas requires basic Python; visualization requires descriptive statistics).
- **Resources:** at least 2 per skill, from recognized sources (official documentation, practice platforms, open courses), with `level_min` and `level_max` and a variety of `type`. **Each URL must be verified with a real request before including it.** Links from memory without checking are not accepted. If a skill does not reach 2 verified resources, it is left with those available and this is noted.
- The seed must be **idempotent**: running it twice does not duplicate data.

## 6. AI layer (`lib/gemini`)

Minimal interface:

- `generateStructured({ schema, systemPrompt, input, fixtureKey })` returns an object already validated with Zod.
- Behavior: `AI_MODE=fixtures` reads `data/fixtures/agents/<fixtureKey>.json` and validates it; `AI_MODE=live` calls Gemini with JSON output.
- One retry on invalid output; afterwards it throws a typed error (`AgentOutputError`) that the services turn into a fallback.
- Configurable timeout and without logging the content of prompts containing personal data in production logs.
- The model is read from `GEMINI_MODEL`.

## 7. Routes

| Route | Function |
|---|---|
| `GET /api/health` | Returns `{ db: "ok" \| "error", ai: "ok" \| "fixtures" \| "error", seededRoles: number }`. The AI check makes a minimal structured call (or confirms fixtures mode) |
| `POST /api/demo/reset` | Deletes learner data and re-seeds. Only with `DEMO_MODE=true` or outside production; responds 403 otherwise |

## 8. Acceptance criteria

1. The Vercel URL loads a home page that shows the status of `/api/health` and the name of the seeded role.
2. `GET /api/health` on the deployment returns `db: "ok"` and `ai: "ok"` (or `"fixtures"` if `AI_MODE=fixtures`).
3. The migration creates all the tables in section 4 and the seed is idempotent (checked by running it twice).
4. Each skill of the role has its prerequisites without cycles (there is a test that verifies it).
5. All `resources` URLs were verified; there is a script `npm run seed:check-urls` that checks them.
6. With `AI_MODE=fixtures`, `generateStructured` returns the validated fixture; with an invalid output it retries once and throws `AgentOutputError`.
7. `POST /api/demo/reset` works with `DEMO_MODE=true` and responds 403 without it.
8. There is no key in the repository; `.env.example` lists all the variables.
9. `typecheck`, `lint` and `test` pass.

## 9. Required tests

- Unit: prerequisite cycle validation; seed idempotence; `generateStructured` with valid output, invalid output and fixtures mode.
- Browser verification of the deployment (criteria 1 and 2).

## 10. Notes for the agent

- Prioritize **deploying early**: do the deployment with the health page before completing the seed.
- If Gemini does not respond on the deployment, leave `AI_MODE=fixtures` and note it in the final summary; do not block the rest.
