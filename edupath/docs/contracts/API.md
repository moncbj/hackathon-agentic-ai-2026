# EduPath: API Contracts

This document specifies the HTTP API contracts exposed by the EduPath backend.
All endpoints are server-side only under `/api/`.

---

## 1. System Health

### `GET /api/health`

Performs an end-to-end health verification of the database connection and the AI layer.

- **Authentication:** None (public monitoring route)
- **Method:** `GET`
- **Cache:** `no-store` (force-dynamic)

#### Response (200 OK)

```json
{
  "db": "ok",
  "ai": "fixtures",
  "seededRoles": 1
}
```

#### Field Specifications

| Field | Type | Description |
|---|---|---|
| `db` | `"ok" \| "error"` | Status of the Supabase PostgreSQL database connection |
| `ai` | `"ok" \| "fixtures" \| "error"` | Status of AI layer: `"ok"` (live Gemini operational), `"fixtures"` (`AI_MODE=fixtures` mock mode), or `"error"` (call failure) |
| `seededRoles` | `number` | Total number of roles present in the database catalog |

---

## 2. Demo Management

### `POST /api/demo/reset`

Clears all learner-generated demo data and re-seeds the foundational catalog (roles, skills, prerequisites, and verified resources) idempotently.

- **Authentication:** Protected by environment configuration.
  - In production (`NODE_ENV=production`), requires `DEMO_MODE=true`. If `DEMO_MODE !== 'true'`, returns `403 Forbidden`.
  - In non-production environments (development/test), available without restriction.
- **Method:** `POST`

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Demo reset completed successfully.",
  "seedSummary": {
    "rolesCount": 1,
    "skillsCount": 11,
    "roleSkillsCount": 11,
    "prerequisitesCount": 8,
    "resourcesCount": 22
  }
}
```

#### Error Responses

- **403 Forbidden:**

```json
{
  "error": "Forbidden: Demo reset is disabled in production unless DEMO_MODE=true."
}
```

- **500 Internal Server Error:**

```json
{
  "error": "Failed to execute demo reset.",
  "details": "Error message description"
}
```

---

## 3. Onboarding & Profile (SPEC-001)

### `POST /api/onboarding`

Creates the learner profile, tutor preferences, and computes initial skill states.

- **Authentication:** None (Single-user MVP)
- **Method:** `POST`
- **Content-Type:** `application/json`
- **Cache:** `no-store` (force-dynamic)

#### Request Body

```json
{
  "name": "Ana García",
  "background": "Graduada en Matemáticas",
  "targetRoleId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "weeklyHours": 12,
  "declaredLevels": {
    "sql": 2,
    "spreadsheets": 3
  },
  "extraSkills": [
    {
      "name": "Git",
      "level": 2
    }
  ],
  "tutorStyle": {
    "language": "es",
    "tone": "cercano",
    "detailLevel": "equilibrado",
    "useAnalogies": true,
    "freeInstructions": "Explícamelo con ejemplos prácticos"
  }
}
```

#### Field Specifications

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | `string` | Yes | 1–100 chars |
| `background` | `string` | No | Max 2000 chars, default `""` |
| `targetRoleId` | `string` | Yes | UUID format |
| `weeklyHours` | `number` | Yes | Integer 1–40 |
| `declaredLevels` | `object` | No | Keys: skillId or slug; Values: integer 0–4 |
| `extraSkills` | `array` | No | Objects with `name` (1–100 chars) and `level` (0–4) |
| `tutorStyle.language` | `string` | No | Default `"es"` |
| `tutorStyle.tone` | `string` | Yes | `"formal"` \| `"cercano"` \| `"motivador"` |
| `tutorStyle.detailLevel` | `string` | Yes | `"resumido"` \| `"equilibrado"` \| `"profundo"` |
| `tutorStyle.useAnalogies` | `boolean` | Yes | `true` \| `false` |
| `tutorStyle.freeInstructions` | `string` | No | Max 500 chars |

#### Response (201 Created)

```json
{
  "learner": {
    "id": "22222222-2222-2222-2222-222222222222",
    "name": "Ana García",
    "targetRoleId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    "background": "Graduada en Matemáticas",
    "weeklyHours": 12,
    "extraSkills": [{ "name": "Git", "level": 2 }],
    "createdAt": "2026-09-19T00:00:00.000Z"
  },
  "tutorStyle": {
    "language": "es",
    "tone": "cercano",
    "detailLevel": "equilibrado",
    "useAnalogies": true,
    "freeInstructions": "Explícamelo con ejemplos prácticos"
  },
  "skillStates": [
    {
      "skillId": "uuid",
      "skillSlug": "sql",
      "skillName": "SQL",
      "level": 2,
      "requiredLevel": 3,
      "verification": "self_reported",
      "status": "available",
      "progress": 0,
      "consecutiveFailures": 0
    }
  ]
}
```

#### Error Responses

- **400 Bad Request:** Validation failure (e.g. weeklyHours out of range 1–40, freeInstructions > 500 chars) or role has no skills.
- **404 Not Found:** `{"error": "Role not found"}` when targetRoleId does not match a seeded role.
- **409 Conflict:** `{"error": "A learner already exists. Use POST /api/demo/reset to start over.", "code": "LEARNER_EXISTS"}`
- **500 Internal Server Error:** Database failure during sequential insertion.

---

### `POST /api/profile/extract`

Extracts and analyzes skills from a CV / document (pasted text or uploaded file) using the Profile Agent.

- **Authentication:** None (Single-user MVP)
- **Method:** `POST`
- **Content-Type:** `application/json` (pasted text) or `multipart/form-data` (file upload)
- **Cache:** `no-store` (force-dynamic)

#### Request (JSON Mode)

```json
{
  "text": "Experiencia de 2 años con Python, SQL y visualización de datos...",
  "targetRoleId": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
}
```

#### Request (Multipart Mode)

- `file`: PDF or TXT binary file (Max 5 MB, PDF max 10 pages)
- `targetRoleId`: UUID string of target role

#### Response (200 OK)

```json
{
  "proposedSkills": [
    {
      "skillSlug": "basic-python",
      "skillName": "Basic Python",
      "proposedLevel": 2,
      "rationale": "Menciona 2 años de experiencia con Python y scripts",
      "confidence": "medium"
    }
  ],
  "unmappedSkills": [
    {
      "name": "Docker",
      "proposedLevel": 1,
      "rationale": "Menciona uso básico de contenedores"
    }
  ],
  "summary": "El perfil muestra experiencia sólida en programación básica..."
}
```

#### Error Responses

- **400 Bad Request:** Missing text/file, file > 5MB, disallowed type (not PDF/TXT), PDF > 10 pages, empty extracted text.
- **404 Not Found:** Target role not found.
- **502 Bad Gateway:** AI model call failure or schema validation failure after retry (`{"error": "AI extraction failed. Continue manually.", "code": "AI_ERROR"}`).
- **500 Internal Server Error:** Extraction processing failure.

---

### `GET /api/learner`

Retrieves the currently active learner profile along with tutor style and current skill states.

- **Authentication:** None (Single-user MVP)
- **Method:** `GET`
- **Cache:** `no-store` (force-dynamic)

#### Response (200 OK)

Shape identical to the `POST /api/onboarding` 201 response body:

```json
{
  "learner": {
    "id": "uuid",
    "name": "Ana García",
    "targetRoleId": "uuid",
    "background": "...",
    "weeklyHours": 12,
    "extraSkills": [],
    "createdAt": "2026-09-19T..."
  },
  "tutorStyle": {
    "language": "es",
    "tone": "cercano",
    "detailLevel": "equilibrado",
    "useAnalogies": true,
    "freeInstructions": "..."
  },
  "skillStates": [
    {
      "skillId": "uuid",
      "skillSlug": "sql",
      "skillName": "SQL",
      "level": 2,
      "requiredLevel": 3,
      "verification": "self_reported",
      "status": "available",
      "progress": 0,
      "consecutiveFailures": 0
    }
  ]
}
```

#### Error Responses

- **404 Not Found:** `{"error": "No learner profile found"}` when no active learner has been created.
- **500 Internal Server Error:** Database query failure.

