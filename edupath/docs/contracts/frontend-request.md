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

### 3. Roles and their skills (SPEC-001, steps 1 and 2)

- **Needed by:** the target role list (step 1) and the skills of the chosen role (step 2).
- **Problem:** SPEC-001 has no route to list roles and their skills.
- **Proposal:** `GET /api/roles` returning
  `{ roles: [{ id, slug, name, description, skills: [{ slug, name, description, category }] }] }`.
- **Status:** pending decision. The frontend works against mocks in the meantime.

### 4. `POST /api/onboarding` request body

- **Problem:** the spec lists the fields but not the exact shape.
- **Proposal (what the frontend sends today):**

```ts
{
  name: string;
  background: string;                       // may be empty
  targetRoleSlug: string;
  weeklyHours: number;                      // integer 1..40
  skillLevels: Record<string, 0 | 1 | 2 | 3 | 4>;  // one entry per skill of the role, default 0
  extraSkills: { name: string; level: 0 | 1 | 2 | 3 | 4 }[];
  tutorStyle: {
    language: string;                       // "en" | "es"
    tone: "formal" | "cercano" | "motivador";
    detailLevel: "resumido" | "equilibrado" | "profundo";
    useAnalogies: boolean;
    freeInstructions: string;               // up to 500 characters
  };
}
```

- **Response the UI needs:** `{ id: string, name: string }`. It answers 409 if a learner already exists.

### 5. `POST /api/profile/extract` request

- **Proposal:** JSON `{ text: string }` for pasted text. PDF/TXT upload will be added later (multipart) if time allows.
- **Response:** as in SPEC-001 (`proposedSkills`, `unmappedSkills`, `summary`).

### 6. `GET /api/learner`

- The UI treats a 404 as "no learner yet" and redirects to `/onboarding`. It only needs `id` and `name` from the 200 response for now.

### 7. Tutor language

- The UI is in English, so the frontend sends `language: "en"` by default (`"es"` as the other option). Please confirm the accepted values and that the agents' prompts and fixtures respond in English by default.
- `tone` and `detailLevel` keep the Spanish enum values from the schema; the UI shows English labels.