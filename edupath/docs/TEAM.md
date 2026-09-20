# EduPath — Team Development Rules

## Roles

### Backend Owner

Responsible for:

- `domain/`
- `agents/`
- `services/`
- `lib/`
- `app/api/`
- `supabase/`
- `data/seed/`
- `data/fixtures/`

The Backend Owner implements business logic, persistence, Gemini integrations, agents, validations and APIs.

### Frontend Owner

Responsible for:

- `components/`
- pages inside `app/` except `app/api/`
- styles
- loading, error and empty states
- user interaction
- animations
- API consumption

The Frontend Owner does not modify domain logic or endpoints to fix interface problems.

### Shared Areas

Both can read and discuss:

- `docs/`
- `package.json`
- `tsconfig.json`
- shared types and contracts

Changes that affect both sides must be agreed before being implemented.

## API Boundary

The frontend consumes only the documented APIs.

The backend owns the internal implementation of the APIs.

The frontend must not directly import:

- `domain/`
- `services/`
- `lib/db/`
- `lib/gemini/`
- `agents/`

The backend must not introduce interface logic inside:

- `domain/`
- `services/`
- `agents/`

## Git

Each person works on their own branch:

- `feat/backend`
- `feat/frontend`

Never develop directly on `main`.

Before modifying files that potentially belong to the other role, stop and review the contract or coordinate the change.

## Definition of Done

A task is not considered finished until:

1. it works;
2. it respects the architecture;
3. it passes typecheck, lint and relevant tests;
4. it does not break the other role's work;
5. contract changes are documented when applicable.