# SPEC-002: Skill Gap Analysis and skill tree

- **Status:** implemented
- **Priority:** P0
- **Depends on:** SPEC-000, SPEC-001
- **Capabilities:** F-03, F-04, F-14
- **Read first:** `/docs/PRODUCT.md` (sections 8, 9 and 10), `/docs/specs/README.md`

## 1. Objective

Show the user, at a glance and in an appealing way, **where they stand against the role they want**: which skills they master, which ones they lack and which ones are unverified. The calculation is deterministic; the Gap Analysis Agent only explains it in approachable language.

## 2. Scope

**Includes**

- Deterministic calculation of gaps, priority and skills suggested for verification.
- Gap Analysis Agent to explain gaps and priorities, with cache.
- `/dashboard` with the **skill tree** as the protagonist, a summary panel and a priority list.
- Detail panel for a skill.

**Does not include**

- Weekly plan, objectives and activities (SPEC-003).
- Starting assessments (the "Assess" button remains visible but is connected in SPEC-004; until then it appears disabled with a note).
- Editing the self-declared level.

## 3. Design

### 3.1 Domain (`domain/gaps`)

`computeGapAnalysis({ roleSkills, learnerSkills, prerequisites })` returns for each skill of the role:

- `gap = max(0, required_level - level)`
- `dependentsWithGap` = number of skills that have this one as a prerequisite and whose gap is greater than 0
- `priority = weight * gap * (1 + PRIORITY_DEPENDENT_BONUS * dependentsWithGap)`
- `needsVerification = true` if `gap = 0`, `verification = self_reported` and `weight >= VERIFY_MIN_WEIGHT`

Result sorted by `priority` descending; ties are resolved by prerequisite depth (lower first) and then by name. The **study** order (not importance) is decided by SPEC-003 respecting prerequisites.

**Example for tests** (`PRIORITY_DEPENDENT_BONUS = 0.25`, `VERIFY_MIN_WEIGHT = 4`)

| Skill | Required | Weight | Level | Prerequisite | Gap | Dependents with gap | Priority | Verify? |
|---|---|---|---|---|---|---|---|---|
| A | 3 | 4 | 1 | n/a | 2 | 1 (B) | 4 × 2 × 1.25 = **10** | No |
| B | 3 | 5 | 0 | A | 3 | 0 | 5 × 3 × 1 = **15** | No |
| C | 2 | 3 | 2 (`self_reported`) | n/a | 0 | 0 | 0 | No (weight 3) |
| D | 3 | 5 | 3 (`self_reported`) | n/a | 0 | 0 | 0 | **Yes** (weight 5) |

Resulting order: B (15), A (10), then C and D with priority 0 (D also appears in the verification list).

### 3.2 Gap Analysis Agent (`agents/gap-analysis`)

- **Input:** `{ role: { name }, gaps: [{ skillSlug, name, level, requiredLevel, gap, priority }], toVerify: [{ skillSlug, name, level }], tutorStyle }`
- **Output:**
  - `summary`: text of 2 to 4 sentences (max. 500 characters)
  - `perSkill`: list of `{ skillSlug, explanation (max. 250 characters), whyItMatters (max. 200 characters) }`
  - `recommendedFocus`: list of up to 3 `skillSlug`
- **Validation:** all `skillSlug` must exist in the input (the rest are discarded). The agent **cannot** change gaps, priorities or order; it only explains.
- **Tone:** approachable, encouraging, non-condescending, respecting the Tutor Style.
- **Cache:** saved in `gap_analyses` with `input_hash` (stable hash of the input). If the hash matches, it is reused without calling the model.

### 3.3 Routes

| Route | Function |
|---|---|
| `GET /api/skill-tree` | Returns nodes (skill, level, `verification`, `status`, `progress`, gap, required, weight) and edges (prerequisites). No AI calls |
| `GET /api/gaps` | Returns the deterministic result and, if it exists or can be generated, the agent's explanation (with cache). At most a single LLM call. If the agent fails, it returns only the deterministic part |

### 3.4 Interface (`/dashboard`)

**Skill tree (main component)**

- Directed graph by prerequisites, with layered layout according to prerequisite depth (deterministic, not depending on a random simulation). `@xyflow/react` is suggested; any equivalent library is valid.
- Each node shows: name, current and required level (for example with "pips"), and status.
- **Distinct visual states** with a legend: `locked` (dimmed), `available`, `in_progress`, `acquired`, `struggling` (alert).
- Differentiated mark for `self_reported` versus `verified` (for example dotted versus solid outline, or a seal).
- Clicking a node opens the detail panel: level, required, gap, prerequisites, agent's explanation and (disabled until SPEC-004) "Assess" button.
- State transitions are animated with CSS (needed for SPEC-004).

**Side panel**

- Diagnosis summary (agent's text or, if it fails, a deterministic summary with counts).
- Top priorities (up to 5) with their gap.
- "Unverified" list with the `needsVerification` skills.

**Screen states:** loading (skeletons), error with retry, and no learner (redirects to `/onboarding`).

## 4. Acceptance criteria

1. With the learner created in SPEC-001, `/dashboard` shows the skill tree with **all** the skills of the role and their prerequisites as edges.
2. The calculation of gaps and priorities matches the example table (verified by unit test).
3. Each status (`locked`, `available`, `in_progress`, `acquired`, `struggling`) has a distinct visual representation and there is a legend.
4. `self_reported` skills are visually distinguished from `verified` ones.
5. The side panel lists the priorities sorted by descending priority and the unverified skills.
6. Clicking a node shows its detail; the "Assess" button is disabled with a note.
7. The agent's explanation appears when available; if the agent fails, the dashboard keeps working with the deterministic information and without blocking visible errors.
8. Reloading the page does not call the model again if the input did not change (cache by `input_hash`).
9. `recommendedFocus` never includes a nonexistent `skillSlug`.
10. The tree is readable on desktop and usable on mobile (zoom and scroll).
11. Works on the Vercel deployment.

## 5. Required tests

- Unit tests of `computeGapAnalysis` with the example and edge cases (no gaps, all with gaps, cycles impossible due to the SPEC-000 validation).
- Gap Analysis Agent contract (valid fixture, nonexistent slug, text too long) and hash cache test.
- Browser verification: loading, node clicks, states and legend.

## 6. Notes for the agent

- The skill tree is the element most seen in the demo: give it visual care (coherent palette, readable typography, smooth animation), without sacrificing data correctness.
- Leave ready the state-change animation hooks and the connection point of the "Assess" button for SPEC-004.
- Agent fixture: `data/fixtures/agents/gap-analysis.json`.
