# EduPath: frontend requests to the backend

> Owned by the Frontend Owner. The Backend Owner reads it and decides. Nothing here changes the backend by itself.

## Open requests

### 1. `GET /api/health`: seeded role name

- **Needed by:** SPEC-000, acceptance criterion 1 (the home page shows the name of the seeded role).
- **Problem:** the documented response only has `seededRoles: number`, so the UI can show a count but not the role name.
- **Proposal:** add an optional field to the response, for example `seededRoleNames: string[]`.
- **Status:** pending decision by the Backend Owner. Until then the home page shows only the count.

### 2. `GET /api/skill-tree`: category of each skill

- **Needed by:** SPEC-002, to group skills by category in the mastery overview.
- **Problem:** the spec lists the node fields (skill, level, `verification`, `status`, `progress`, gap, required, weight) but does not explicitly include the skill `category`, which exists in the `skills` table.
- **Proposal:** include `category` in each node.
- **Status:** pending; to be confirmed when SPEC-002 starts.

## Environment variables introduced by the frontend

| Variable | Use |
|---|---|
| `NEXT_PUBLIC_USE_MOCKS` | `true` makes the frontend API client return mock data. With `?mock=loading\|error\|empty\|ok` in the URL, a single UI state can be forced. Must be `false` or unset in production. Add it to `.env.example`. |