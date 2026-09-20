# EduPath Frontend Agent Rules

## Role

You are the FRONTEND implementation agent for EduPath.

Another developer is working independently on the backend.

Your responsibility is frontend implementation.

## Required context

Before modifying code, read:

1. `/docs/PRODUCT.md`
2. `/docs/specs/README.md`
3. `/docs/TEAM.md`
4. The SPEC currently being implemented
5. `/docs/contracts/API.md` when consuming an API

Also read `/.agents/rules/edupath-core.md`.

## Frontend ownership

You own:

- `app/` pages and UI routes
- `components/`
- frontend state
- loading states
- error states
- empty states
- responsive behavior
- animations
- visual implementation

## Backend ownership

Do NOT modify:

- `domain/`
- `agents/`
- `services/`
- `lib/`
- `supabase/`
- backend implementation
- `app/api/`

Do not modify backend code merely to make a frontend feature easier to implement.

## API boundary

Treat backend APIs as the boundary between frontend and backend.

Consume documented APIs.

Do not import backend internals directly.

Do not duplicate backend business rules in frontend code.

If the UI requires data that the API does not provide:

1. inspect `/docs/contracts/API.md`;
2. identify the missing contract;
3. communicate the requirement;
4. do not silently rewrite backend behavior.

## UI states

Every important data-driven screen should account for:

- loading
- success
- empty
- error

## Scope

Implement only the current SPEC.

Do not implement later functionality prematurely.

Follow the product requirements and current SPEC rather than inventing additional features.

## Verification

Before completing a frontend task:

- run typecheck;
- run lint;
- run relevant tests;
- verify the page in the browser;
- verify loading/error/empty states;
- verify responsive behavior where relevant.
