# SPEC-001: Onboarding and Learner Profile

- **Status:** pending
- **Priority:** P0
- **Depends on:** SPEC-000
- **Capabilities:** F-01, F-02, F-16
- **Read first:** `/docs/PRODUCT.md` (sections 5, 8 and 11), `/docs/specs/README.md`

## 1. Objective

Let a person create their profile in a few minutes: their goal, their self-declared skills (which the system **assumes correct at the start**) and how they like things explained to them. Optionally they can upload their CV so that the Profile Agent suggests levels to them.

## 2. Scope

**Includes**

- 3-step wizard at `/onboarding`.
- Profile Agent to propose skills from the text of a CV, portfolio or project descriptions.
- Creation of the learner, their initial skill state and their Tutor Style.
- Deterministic calculation of the initial state of each skill.
- Redirect to `/dashboard` (SPEC-002) when finished.

**Does not include**

- Accounts, login or later profile editing (P1).
- Storing uploaded files: the text is processed in memory and **is not saved**.
- Level verification (SPEC-004).
- Skills outside the role's catalog within the gap calculation (they are saved only as informational notes).

## 3. User flow

**Step 1: goal and context**

- Name, education or experience (free text), target role (list from `roles`; for now only the seeded role) and available hours per week (1 to 40).

**Step 2: skills**

- The skills of the chosen role are listed, each with a level control from 0 to 4 with short descriptions (0 no knowledge … 4 expert). Default 0.
- "Help me with my CV" button: allows pasting text or uploading a PDF or TXT file (maximum 5 MB, 10 pages). The Profile Agent returns proposed levels with a brief justification; **the user reviews them and applies them as they see fit**. Nothing is applied automatically.
- Field to add "other skills" (name and level). They are saved in `learners.extra_skills` without affecting the analysis.

**Step 3: tutor style**

- Language (Spanish by default), tone (`formal`, `cercano`, `motivador`), level of detail (`resumido`, `equilibrado`, `profundo`), use of analogies (yes or no) and a free-form natural-language instructions field (for example "explain it to me with cooking examples", maximum 500 characters).

On confirming, everything is created and the user is redirected to `/dashboard`.

## 4. Design

### 4.1 Domain (`domain/skill-state`)

`computeInitialSkillStates({ roleSkills, declaredLevels, prerequisites })` returns the state of each skill of the role:

- `level` = declared level; `verification` = `self_reported`; `progress` = 0; `consecutive_failures` = 0.
- `status`:
  - `acquired` if `level >= required_level` of the role.
  - `locked` if it has any prerequisite with a level lower than `PREREQ_MIN_LEVEL` and it is not `acquired`.
  - `available` otherwise.

**Examples for tests**

| Skill | Required | Declared | Prerequisite (level) | Result |
|---|---|---|---|---|
| A | 3 | 3 | n/a | `acquired`, `self_reported` |
| B | 3 | 0 | A (3) | `available` |
| C | 2 | 0 | B (0) | `locked` |
| D | 2 | 1 | none | `available` |

### 4.2 Profile Agent (`agents/profile`)

- **Input:** `{ documentText: string, roleSkills: [{ slug, name }], declaredLevels?: { [slug]: number } }` (text truncated to a reasonable maximum).
- **Output:**
  - `proposedSkills`: list of `{ skillSlug, proposedLevel (0–4), rationale (max. 200 characters), confidence ("low" | "medium" | "high") }`
  - `unmappedSkills`: list of `{ name, proposedLevel (0–4), rationale }`
  - `summary`: brief text (max. 400 characters)
- **Validation in the service:** every `skillSlug` must exist in `roleSkills`; those that don't are discarded; levels outside 0–4 invalidate the output.
- **Prompt rules:** do not inflate levels without textual evidence; when in doubt, propose the lowest reasonable level and `confidence: "low"`; do not invent experience; respond in Spanish.

### 4.3 Services and routes

| Route | Function |
|---|---|
| `POST /api/profile/extract` | Receives text or a file, extracts text on the server (`lib/pdf`), calls the Profile Agent and returns the proposals. **A single LLM call** |
| `POST /api/onboarding` | Validates the complete form, creates `learners`, `tutor_styles` and `learner_skills` (using the domain) and returns the learner. If a learner already exists, responds 409 |
| `GET /api/learner` | Returns the active learner with their Tutor Style and skill states, or 404 |

If the Profile Agent fails, `/api/profile/extract` responds with a handled error and the interface allows continuing manually.

## 5. Acceptance criteria

1. A user without a learner who opens `/` or `/dashboard` is redirected to `/onboarding`.
2. The wizard validates required fields and ranges (hours from 1 to 40, levels from 0 to 4, free instructions up to 500 characters) and shows the errors inline.
3. On finishing, there exist: 1 row in `learners`, 1 in `tutor_styles` and one row in `learner_skills` for **each skill of the role**, with `verification = self_reported`.
4. The initial states match the table of examples in the design.
5. Pasting CV text and pressing "Help me with my CV" shows proposals with justification; the user can apply them one by one or all at once, and **none changes the levels without explicit action**.
6. Proposals with a nonexistent `skillSlug` never appear in the interface.
7. Uploading a file larger than 5 MB or of a disallowed type shows a clear error and does not break the wizard.
8. The CV text is not saved in the database or in storage.
9. If the Profile Agent fails or returns an invalid output twice, the user can complete onboarding manually.
10. Completing onboarding on the Vercel deployment leads to `/dashboard` (even if it is still empty until SPEC-002).

## 6. Required tests

- Unit tests of `computeInitialSkillStates` with the examples from the table and edge cases (no prerequisites, level equal to the required one).
- Profile Agent contract with a valid fixture, output with a nonexistent slug and out-of-range level.
- Integration of `POST /api/onboarding` with `AI_MODE=fixtures`.
- Browser verification of the complete walkthrough of the 3 steps.

## 7. Notes for the agent

- The self-declared levels **are not questioned** here: verification comes in SPEC-004.
- Keep the wizard fast: if the CV upload complicates the schedule, deliver the pasted-text input first and leave PDF for last.
- Profile Agent fixture: create `data/fixtures/agents/profile.json` with a realistic case of a data analysis profile.
