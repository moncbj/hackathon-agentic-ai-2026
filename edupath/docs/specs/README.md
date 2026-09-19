# EduPath: initial specs

> Lives in `/docs/specs/`. **Product source of truth:** `/docs/PRODUCT.md`. Every spec must be read together with that document and this README.
> Domain terms are in English (Skill State, Assessment, Journey…) to match the code. The interface and the agent prompts are in Spanish.

## 1. Index

| Spec | Name | Capabilities (PRODUCT.md) | Depends on | If time runs short |
|---|---|---|---|---|
| [SPEC-000](./SPEC-000-foundation.md) | Foundation, data and deployment | Foundation for everything | n/a | Not cut |
| [SPEC-001](./SPEC-001-onboarding-profile.md) | Onboarding and Learner Profile | F-01, F-02, F-16 | 000 | Not cut (CV upload can be skipped) |
| [SPEC-002](./SPEC-002-gaps-skill-tree.md) | Skill Gap Analysis and skill tree | F-03, F-04, F-14 | 000, 001 | Not cut |
| [SPEC-003](./SPEC-003-objectives-journey.md) | Objectives, weekly Journey and activities | F-05 to F-09 | 002 | Not cut |
| [SPEC-004](./SPEC-004-assessment-replanning.md) | Assessment, Skill State and replanning | F-10 to F-13 | 003 | Not cut: it is the differentiator |
| [SPEC-005](./SPEC-005-tutor-report-notebooks.md) | Tutor, report and minimal notebook | F-15, F-17, F-18 | 001 (partial 004) | Cut first: notebook, then report |

## 2. Suggested order for a day and a half and two people

| Block | Person A | Person B |
|---|---|---|
| **H0–4** | SPEC-000 (together, includes deploying the connected "hello world") | SPEC-000 |
| **H4–10** | SPEC-001 | SPEC-002 (can start with the seed data) |
| **H10–16** | SPEC-003 | SPEC-003 (journey UI) and refining the skill tree |
| **Rest** | Sleep | Sleep |
| **Day 2, morning** | SPEC-004 (domain, agent and replanning) | SPEC-004 (assessment UI and tree animations) |
| **Day 2, afternoon** | SPEC-005 (chat and report) and polish | `fixtures` mode, star scenario, backup video |

Work on separate branches per spec and merge often. Each spec ends with its browser verification before starting the next one.

## 3. Cross-cutting rules (mandatory for every spec)

1. **Stack:** Next.js (App Router) + React + TypeScript + Tailwind; Supabase (PostgreSQL); Gemini API; Vercel; GitHub. **Do not use pgvector or RAG in the MVP** (decided in P1). Do not add technologies outside this list without authorization.
2. **Layers and responsibilities:**
   - `domain/`: pure TypeScript, **no I/O, no AI, no data access**. Deterministic business rules.
   - `agents/`: one directory per agent with prompt, input and output schemas (Zod) and an execution function. **An agent never touches the database or the user's state.**
   - `services/`: orchestrate repositories, agents and domain (load data, call the agent, pass its output through the domain, persist).
   - `lib/`: isolated integrations (`db`, `gemini`, PDF reading). No other code imports them directly from outside `services/` and `agents/`.
   - `app/api/*`: thin handlers that validate input and delegate to `services/`.
3. **Determinism first:** gap calculation, priority, weekly planning, multiple-choice grading, Skill State updates and replanning triggers are deterministic logic. The LLM only generates content and grades open-ended answers.
4. **Structured outputs:** every LLM output is validated with Zod. If invalid: one retry; if it fails again, a deterministic fallback is applied and **the user's state is not modified**.
5. **One endpoint, at most one LLM call** (serverless function time limits force long flows to be split into several requests).
6. **Data:** all database access happens on the server with the service key. The client never talks to Supabase. No key is exposed to the browser or enters the repository.
7. **No authentication in the MVP:** there is a single active learner. `POST /api/demo/reset` resets the demo (deletes and re-seeds). Only available outside production or with `DEMO_MODE=true`.
8. **`fixtures` mode:** with `AI_MODE=fixtures` the agents return responses from `data/fixtures/agents/*.json` without calling Gemini. Useful for tests, cost-free development and as a demo backup.
9. **Real resources:** no agent invents links. Resources come only from the catalog (`resources`), and every seed URL must have been verified (correct response) when loaded.
10. **Interface:** in Spanish, with loading, empty and error states on every screen, and usable on desktop and mobile.
11. **Scope:** do not implement anything marked "Not included". If something seems necessary and is not in the spec, log it as a question in the spec instead of improvising it.

## 4. Target repository structure

```
edupath/
├── docs/
│   ├── PRODUCT.md
│   └── specs/                  # this directory
├── .agents/
│   └── rules/                  # cross-cutting rules (see section 8)
├── app/                        # pages and API routes (Next.js App Router)
│   ├── onboarding/
│   ├── dashboard/
│   ├── journey/
│   ├── assessment/[skillSlug]/
│   ├── progress/
│   ├── notebooks/
│   ├── tutor/
│   └── api/
├── components/                 # ui, skill-tree, journey, assessment, tutor
├── domain/                     # pure logic (gaps, skill-state, journey, assessment, report)
├── agents/
│   ├── profile/                # prompt.md, schema.ts, run.ts
│   ├── gap-analysis/
│   ├── planner/
│   ├── assessment/
│   └── tutor/
├── services/
├── lib/
│   ├── db/                     # repositories (Supabase)
│   ├── gemini/                 # client, fixtures mode, retries
│   └── pdf/
├── data/
│   ├── seed/                   # roles, skills, prerequisites, resources
│   └── fixtures/agents/        # sample responses per agent
├── supabase/migrations/
└── tests/                      # unit (domain), contract (agents), e2e (star scenario)
```

## 5. Environment variables

| Variable | Use |
|---|---|
| `GEMINI_API_KEY` | Gemini API key (server only) |
| `GEMINI_MODEL` | Model to use (configurable) |
| `AI_MODE` | `live` or `fixtures` |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service key (server only) |
| `DEMO_MODE` | `true` enables the demo reset |

Document all of them in `.env.example` (without real values).

## 6. Domain constants (provisional)

Defined in `domain/constants.ts` as a single configuration point. They are adjusted without touching the logic.

| Constant | Value | Use |
|---|---|---|
| Level scale | 0 to 4 | 0 no knowledge, 1 basic, 2 intermediate, 3 advanced, 4 expert |
| `PREREQ_MIN_LEVEL` | 1 | Minimum level of a prerequisite to unlock a skill |
| `PRIORITY_DEPENDENT_BONUS` | 0.25 | Priority bonus for each dependent skill that also has a gap |
| `VERIFY_MIN_WEIGHT` | 4 | Minimum weight to suggest verifying a skill with no gap |
| `MINUTES_PER_LEVEL` | 300 | Estimated effort per level of gap |
| `WIP_LIMIT` | 2 | Maximum active skills per week |
| `JOURNEY_HORIZON_WEEKS` | 4 | Visible weeks of the plan |
| `QUESTION_COUNT` | 5 | Questions per assessment (3 multiple-choice and 2 short-answer) |
| `PASS_THRESHOLD` | 0.7 | Minimum score to pass |
| `PARTIAL_THRESHOLD` | 0.4 | Minimum score to drop only one level on failure |
| `STRUGGLE_THRESHOLD` | 2 | Consecutive failed assessments to mark `struggling` |
| `STRUGGLE_BOOST` | 1.5 | Priority multiplier for `struggling` skills |
| `SKIPPED_REPLAN_THRESHOLD` | 2 | Skipped activities that trigger replanning |

## 7. Common Definition of Done

A spec is considered finished only if:

1. It meets **all** of its acceptance criteria, verified one by one (in the browser where applicable).
2. `typecheck`, `lint` and tests pass without errors.
3. The `domain/` logic has unit tests that include the spec's numerical examples.
4. Each agent has Zod input and output schemas, and a fixture that satisfies them.
5. Loading, empty and error states exist on the new screens.
6. It works on the Vercel deployment, not just locally.
7. There are no keys or secrets in the repository and `.env.example` is up to date.
8. Nothing outside the scope was implemented.
9. The spec's status (`Status:`) was updated and anything that could not be verified was noted.

## 8. Ready-to-use rule for `.agents/rules/`

Create `.agents/rules/edupath.md` with this content (according to the reference document, Antigravity reads persistent rules from that path; confirm it in the tool):

```
Before writing code, read /docs/PRODUCT.md, /docs/specs/README.md and the assigned spec.
Implement only what the spec includes. Do not add technologies or infrastructure that are not listed.
domain/ is pure: no I/O, no AI, no data access.
Agents do not write to the database or modify the user's state.
Every LLM output is validated with Zod; if invalid, retry once and use the fallback.
An endpoint makes at most one LLM call.
Never invent resource URLs: only use the verified catalog.
When finished, verify each acceptance criterion (in the browser if applicable) and report what you could not verify.
```

## 9. Starter prompt for each spec

```
Read /docs/PRODUCT.md, /docs/specs/README.md and /docs/specs/SPEC-00X-<name>.md.
Implement the complete spec respecting its scope and the cross-cutting rules.
Plan first, then implement by layers (domain, agents, services, api, UI).
Verify each acceptance criterion, including the browser flow and the deployment,
and deliver a summary of what you verified and what you could not verify.
Do not implement anything that the spec marks as "Not included".
```
