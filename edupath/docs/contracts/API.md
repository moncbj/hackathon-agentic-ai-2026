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

---

## 4. Skill Tree & Gap Analysis (SPEC-002)

### `GET /api/skill-tree`

Retrieves the complete deterministic skill-tree graph for the active learner's target role. Makes zero AI calls and zero database mutations.

- **Authentication:** None (Single-user MVP)
- **Method:** `GET`
- **Cache:** `no-store` (force-dynamic)

#### Response (200 OK)

```json
{
  "nodes": [
    {
      "id": "uuid",
      "slug": "spreadsheets",
      "name": "Spreadsheets",
      "level": 3,
      "requiredLevel": 3,
      "gap": 0,
      "weight": 4,
      "verification": "self_reported",
      "status": "acquired",
      "progress": 0,
      "needsVerification": true,
      "depth": 0
    },
    {
      "id": "uuid",
      "slug": "sql",
      "name": "SQL",
      "level": 1,
      "requiredLevel": 3,
      "gap": 2,
      "weight": 5,
      "verification": "self_reported",
      "status": "in_progress",
      "progress": 25,
      "needsVerification": false,
      "depth": 1
    }
  ],
  "edges": [
    {
      "source": "uuid-prerequisite-skill-id",
      "target": "uuid-dependent-skill-id"
    }
  ]
}
```

#### Field Specifications

| Field | Type | Description |
|---|---|---|
| `nodes` | `SkillTreeNode[]` | Array of role skills sorted deterministically by `depth ASC`, `name ASC`, `slug ASC` |
| `nodes[].id` | `string` | Stable UUID of the skill |
| `nodes[].slug` | `string` | Unique alphanumeric slug of the skill |
| `nodes[].name` | `string` | Human-readable skill name |
| `nodes[].level` | `number` | Learner's current level (0–4) |
| `nodes[].requiredLevel` | `number` | Target role's required level (0–4) |
| `nodes[].gap` | `number` | Deterministic gap: `max(0, requiredLevel - level)` |
| `nodes[].weight` | `number` | Skill importance weight in the role |
| `nodes[].verification` | `"self_reported" \| "verified"` | Verification status of the current level |
| `nodes[].status` | `"locked" \| "available" \| "in_progress" \| "acquired" \| "struggling"` | Learner skill progression status |
| `nodes[].progress` | `number` | Progress percentage towards next level (0–100) |
| `nodes[].needsVerification` | `boolean` | `true` if `gap === 0 && verification === 'self_reported' && weight >= 4` |
| `nodes[].depth` | `number` | Longest prerequisite path from root (0 = root node) |
| `edges` | `SkillTreeEdge[]` | Deduplicated prerequisite connections sorted by `source ASC`, `target ASC` |
| `edges[].source` | `string` | Skill ID of the prerequisite |
| `edges[].target` | `string` | Skill ID of the dependent skill |

#### Error Responses

- **400 Bad Request:** `{"error": "Active learner has no target role specified", "code": "NO_TARGET_ROLE"}`
- **404 Not Found:** `{"error": "No active learner profile found", "code": "NO_LEARNER"}`
- **404 Not Found:** `{"error": "Target role \"...\" not found", "code": "ROLE_NOT_FOUND"}`
- **500 Internal Server Error:** Unexpected database or graph assembly failure.

---

### `GET /api/gaps`

Computes deterministic gap analysis and delivers a contextualized explanation from the Gap Analysis Agent. Cached in database using a canonical SHA-256 hash. If the AI agent fails or times out, the endpoint falls back gracefully to HTTP 200 with deterministic data intact and `agentExplanation: null`.

- **Authentication:** None (Single-user MVP)
- **Method:** `GET`
- **Cache:** `no-store` (force-dynamic, cached at database level in `gap_analyses` by canonical input hash)

#### Response (200 OK)

```json
{
  "summary": {
    "totalSkills": 11,
    "acquired": 1,
    "withGap": 10,
    "needsVerification": 1
  },
  "gaps": [
    {
      "skillSlug": "sql",
      "name": "SQL",
      "level": 1,
      "requiredLevel": 3,
      "gap": 2,
      "priority": 12.5,
      "needsVerification": false
    }
  ],
  "topPriorities": [
    {
      "skillSlug": "sql",
      "name": "SQL",
      "gap": 2,
      "priority": 12.5
    }
  ],
  "unverified": [
    {
      "skillSlug": "spreadsheets",
      "name": "Spreadsheets",
      "level": 3
    }
  ],
  "agentExplanation": {
    "summary": "Tienes una buena base en hojas de cálculo, pero requieres afianzar SQL y Python para el rol.",
    "perSkill": [
      {
        "skillSlug": "sql",
        "explanation": "Cuentas con nivel 1 y el rol exige nivel 3 para consultas y agregaciones avanzadas.",
        "whyItMatters": "Es la base indispensable para extracción y modelado de datos en el negocio."
      }
    ],
    "recommendedFocus": [
      "sql",
      "basic-python"
    ]
  }
}
```

#### Field Specifications

| Field | Type | Description |
|---|---|---|
| `summary` | `object` | Aggregate counts: `totalSkills`, `acquired`, `withGap`, `needsVerification` |
| `gaps` | `object[]` | All role skills ordered by `priority DESC`, `depth ASC`, `name ASC`, `slug ASC` |
| `topPriorities` | `object[]` | At most 5 skills with `priority > 0`, preserving priority order |
| `unverified` | `object[]` | All skills with `needsVerification === true` |
| `agentExplanation` | `object \| null` | Natural-language explanation from Gap Analysis Agent (or `null` on AI error or when zero gaps/unverified skills exist) |
| `agentExplanation.summary` | `string` | Overall diagnosis summary (2–4 sentences, max 500 chars) |
| `agentExplanation.perSkill` | `object[]` | Sanitized per-skill breakdown (max 250 chars explanation, max 200 chars whyItMatters) |
| `agentExplanation.recommendedFocus` | `string[]` | Up to 3 priority skill slugs recommended for immediate study |

#### Error Responses

- **400 Bad Request:** `{"error": "Active learner has no target role specified", "code": "NO_TARGET_ROLE"}`
- **404 Not Found:** `{"error": "No active learner profile found", "code": "NO_LEARNER"}`
- **404 Not Found:** `{"error": "Target role \"...\" not found", "code": "ROLE_NOT_FOUND"}`
- **500 Internal Server Error:** Unexpected database failure.

---

## 5. Learning Journey & Activities (SPEC-003)

### `POST /api/journey/generate`

Constructs the personalized weekly learning journey from the deterministic skill gaps computed in SPEC-002, invokes the Learning Planner Agent (at most 1 AI call) to generate narrative missions, instructions, and objectives, and persists `objectives`, `journeys`, and `activities`.

- **Authentication:** None (Single-user MVP)
- **Method:** `POST`
- **Cache:** `no-store` (force-dynamic)
- **AI Calls:** Maximum 1 Planner Agent invocation.

#### Architectural Separation of Concerns
- **Deterministic Engine (`buildJourneySkeleton`):** Determines which skills are scheduled, topological prerequisite study order, week allocation up to 4 weeks (`JOURNEY_HORIZON_WEEKS`), weekly effort budget (`weeklyHours * 60`), WIP limit (maximum 2 distinct skills per week), activity slot types (at least 1 resource slot and 1 practice slot per skill; project slot if gap >= 2), 15-minute slot multiples, and resource selection from the catalog.
- **Learning Planner Agent:** Only writes natural language: objective descriptions, verifiable mastery criteria, mission narratives, practice/project instructions, success criteria, and weekly summaries. It CANNOT alter study order, weeks, minutes, or invent URLs.
- **Fallback Rule:** If the Planner Agent times out, fails, or produces invalid output (missing/unknown slots, invalid skill slugs, excessive text lengths), the service automatically applies the **deterministic minimum fallback**, preserving the full deterministic plan without failing the user request.

#### Response (201 Created)

```json
{
  "journey": {
    "id": "11111111-1111-1111-1111-111111111111",
    "version": 1,
    "isCurrent": true,
    "reason": "initial",
    "summary": "Semana 1: Enfoque en SQL. Semana 2: Enfoque en Spreadsheets.",
    "changes": {
      "weeklySummaries": [
        {
          "week": 1,
          "headline": "Enfoque en SQL",
          "note": "Dedicación estimada: 300 minutos."
        }
      ],
      "isFallback": false
    },
    "createdAt": "2026-01-01T00:00:00Z"
  },
  "weeks": [
    {
      "number": 1,
      "headline": "Enfoque en SQL",
      "note": "Dedicación estimada: 300 minutos.",
      "totalMinutes": 300,
      "activities": [
        {
          "id": "22222222-2222-2222-2222-222222222222",
          "objectiveId": "33333333-3333-3333-3333-333333333333",
          "skillId": "skill-sql",
          "skillSlug": "sql",
          "skillName": "SQL",
          "week": 1,
          "type": "resource",
          "title": "Aprender SQL: Consultas esenciales",
          "mission": "Explora los fundamentos de bases de datos relacionales y sintaxis SELECT.",
          "instructions": "Completa los primeros tres módulos del curso interactivo.",
          "successCriteria": "Escribir consultas básicas con filtros WHERE.",
          "minutes": 150,
          "status": "pending",
          "completedAt": null,
          "resource": {
            "id": "res-sql-1",
            "title": "SQL Tutorial Interactivo",
            "url": "https://example.com/sql-tutorial",
            "type": "course",
            "language": "es",
            "verified": true
          },
          "skill": {
            "id": "skill-sql",
            "slug": "sql",
            "name": "SQL",
            "progress": 0,
            "status": "available",
            "readyForAssessment": false
          }
        }
      ]
    }
  ],
  "objectives": [
    {
      "id": "33333333-3333-3333-3333-333333333333",
      "skillId": "skill-sql",
      "description": "Dominar consultas SQL para análisis de datos.",
      "criteria": [
        "Escribir filtros condicionales.",
        "Realizar agregaciones con GROUP BY."
      ],
      "targetLevel": 3,
      "status": "active"
    }
  ],
  "stats": {
    "totalActivities": 4,
    "completedActivities": 0,
    "skippedActivities": 0,
    "totalMinutes": 600,
    "completedMinutes": 0
  }
}
```

#### Error Responses

- **400 Bad Request:** `{"error": "Active learner has no target role specified", "code": "NO_TARGET_ROLE"}`
- **404 Not Found:** `{"error": "No active learner profile found. Complete onboarding first.", "code": "NO_LEARNER"}`
- **404 Not Found:** `{"error": "Target role \"...\" not found", "code": "ROLE_NOT_FOUND"}`
- **409 Conflict:** `{"error": "An active learning journey already exists for this learner", "code": "JOURNEY_EXISTS"}`
- **500 Internal Server Error:** Database or orchestration error.

---

### `GET /api/journey`

Retrieves the currently active learning journey for the active learner, including weeks, activities (joined with resources and skill progress), objectives, and aggregate statistics.

- **Authentication:** None (Single-user MVP)
- **Method:** `GET`
- **Cache:** `no-store` (force-dynamic)
- **AI Calls:** EXACTLY ZERO AI calls. Reloading the screen never calls Gemini.

#### Response (200 OK)

Same schema structure as `POST /api/journey/generate` response.

#### Error Responses

- **404 Not Found:** `{"error": "No active learner profile found. Complete onboarding first.", "code": "NO_LEARNER"}`
- **404 Not Found:** `{"error": "No active learning journey found", "code": "NO_ACTIVE_JOURNEY"}`
- **500 Internal Server Error:** Unexpected database error.

---

### `POST /api/activities/:id/complete`

Marks an activity as completed (`status = 'done'`), calculates incremental skill progress, updates `learner_skills`, and returns the updated activity and skill state.

- **Authentication:** None (Single-user MVP; validates ownership against the active journey)
- **Method:** `POST`
- **AI Calls:** EXACTLY ZERO AI calls.

#### Progress Calculation Rules
- `progressIncrease = Math.round(activity.estimated_minutes / (currentGap * MINUTES_PER_LEVEL) * 100)`
- Total `progress` is capped at `100`.
- If `status === 'available'` and `progress > 0`, status transitions to `'in_progress'`.
- `readyForAssessment` is a derived boolean: `progress >= 100`.
- **CRITICAL INVARIANT (Rule R-04):** Completing activities NEVER modifies the skill level. Skill levels change exclusively through SPEC-004 assessments.

#### Response (200 OK)

```json
{
  "success": true,
  "activity": {
    "id": "22222222-2222-2222-2222-222222222222",
    "status": "done",
    "completedAt": "2026-01-02T10:00:00Z"
  },
  "skill": {
    "skillId": "skill-sql",
    "level": 1,
    "status": "in_progress",
    "progress": 50,
    "readyForAssessment": false
  }
}
```

#### Error Responses

- **400 Bad Request:** `{"error": "Activity ID is required", "code": "ACTIVITY_NOT_FOUND"}`
- **403 Forbidden:** `{"error": "Activity does not belong to active learner journey", "code": "NOT_OWNER"}`
- **404 Not Found:** `{"error": "Activity \"...\" not found", "code": "ACTIVITY_NOT_FOUND"}`
- **404 Not Found:** `{"error": "No active learner profile found", "code": "NO_LEARNER"}`
- **500 Internal Server Error:** Database update error.

---

### `POST /api/activities/:id/skip`

Marks an activity as skipped (`status = 'skipped'`) and returns the accumulated skipped count for the journey.

- **Authentication:** None (Single-user MVP; validates ownership against active journey)
- **Method:** `POST`
- **AI Calls:** EXACTLY ZERO AI calls.
- **NO REPLANNING:** Skipping records the skip in the database only. Does NOT trigger journey replanning (SPEC-004 owns adaptive replanning).

#### Response (200 OK)

```json
{
  "success": true,
  "activity": {
    "id": "22222222-2222-2222-2222-222222222222",
    "status": "skipped"
  },
  "skippedCount": 1
}
```

#### Error Responses

- **400 Bad Request:** `{"error": "Activity ID is required", "code": "ACTIVITY_NOT_FOUND"}`
- **403 Forbidden:** `{"error": "Activity does not belong to active learner journey", "code": "NOT_OWNER"}`
- **404 Not Found:** `{"error": "Activity \"...\" not found", "code": "ACTIVITY_NOT_FOUND"}`
- **404 Not Found:** `{"error": "No active learner profile found", "code": "NO_LEARNER"}`
- **500 Internal Server Error:** Database update error.



