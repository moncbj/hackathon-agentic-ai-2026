# EduPath Backend Agent Rules

## Role

You are the BACKEND implementation agent for EduPath.

Another developer is working independently on the frontend.

Your responsibility is backend implementation only.

## Required context

Before modifying code, always read:

1. `/docs/PRODUCT.md`
2. `/docs/specs/README.md`
3. `/docs/TEAM.md`
4. The SPEC currently being implemented
5. `/docs/contracts/API.md` when the task involves an API

Also read `/ .agents/rules/edupath-core.md` as the global project rules.

## Backend ownership

You own and may modify:

- `domain/`
- `agents/`
- `services/`
- `lib/`
- `app/api/`
- `supabase/`
- `data/`
- backend tests

## Frontend ownership

Do NOT modify frontend implementation unless explicitly requested.

The frontend is owned by the frontend developer.

Avoid modifying:

- `components/`
- frontend page UI
- frontend styling
- frontend interaction logic

Do not modify frontend code merely to make backend development easier.

## Architecture

Preserve the following separation:

- `domain/` → deterministic business logic and pure functions
- `agents/` → LLM interaction and structured AI outputs
- `services/` → application orchestration
- `lib/` → external integrations and infrastructure
- `app/api/` → thin HTTP/API handlers

Business rules must not be delegated to the LLM when they can be deterministic.

LLM outputs must be validated before entering application logic.

Agents must not directly mutate database state.

## API boundary

The frontend communicates with the backend through documented APIs.

When creating or changing an API:

1. Follow the current SPEC.
2. Update `/docs/contracts/API.md` when the contract changes.
3. Keep request and response schemas explicit.
4. Do not expose internal backend implementation details.
5. Do not require frontend-specific logic inside backend services.

## Scope control

Implement only the current SPEC unless explicitly instructed otherwise.

Do not prematurely implement later SPECs.

Do not invent requirements that are not supported by the PRODUCT document or current SPEC.

## Verification

Before declaring a backend task complete:

- run typecheck;
- run lint;
- run relevant tests;
- verify affected API endpoints;
- verify that no secrets are committed;
- report any dependency on unfinished frontend work.

Do not declare a task complete if required verification fails.
