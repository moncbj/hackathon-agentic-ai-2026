# EduPath Core Rules

## Source of truth

Before implementing functionality, read:

- `/docs/PRODUCT.md`
- `/docs/specs/README.md`
- the SPEC currently being implemented

The PRODUCT document defines the product.
The current SPEC defines the implementation scope.

Do not invent requirements that are not supported by these documents.

## Implementation order

Implement the project in this order:

1. SPEC-000 Foundation
2. SPEC-001 Onboarding and Profile
3. SPEC-002 Gaps and Skill Tree
4. SPEC-003 Objectives and Journey
5. SPEC-004 Assessment and Replanning
6. SPEC-005 Tutor, Reports and Notebooks

Do not skip ahead unless explicitly instructed.

## Architecture

Keep these responsibilities separate:

- `domain/` → deterministic business logic
- `agents/` → LLM-powered behavior
- `services/` → orchestration
- `lib/` → infrastructure and external integrations
- `app/api/` → HTTP boundary
- `components/` → reusable UI
- `app/` → application pages and routes

Do not move business logic into UI components.

Do not move presentation logic into backend domain code.

## AI behavior

AI agents must not control deterministic business rules.

The LLM may generate language, explanations, questions, missions and other explicitly specified generative content.

Deterministic decisions must remain deterministic.

Validate structured LLM outputs before using them.

Respect `AI_MODE=fixtures` when specified by the project.

## Security

Never commit:

- API keys
- database passwords
- service-role keys
- private credentials
- `.env` files containing secrets

Use environment variables.

## Scope

Do not implement functionality belonging to a later SPEC unless explicitly requested.

Do not introduce additional frameworks, services or architectural patterns without a concrete requirement.

## Quality

Before completing a task:

- run typecheck;
- run lint;
- run relevant tests;
- verify the affected functionality;
- inspect the resulting diff;
- ensure the implementation matches the current SPEC.

If a requirement is ambiguous, inspect the documentation before making assumptions.
