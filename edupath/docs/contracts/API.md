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
