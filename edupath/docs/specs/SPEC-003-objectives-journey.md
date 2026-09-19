# SPEC-003: Objectives, weekly Journey and activities

- **Status:** pending
- **Priority:** P0
- **Depends on:** SPEC-002
- **Capabilities:** F-05, F-06, F-07, F-08, F-09
- **Read first:** `/docs/PRODUCT.md` (sections 6, 8, 10 and 11), `/docs/specs/README.md`

## 1. Objective

Turn the gaps into a **personalized weekly plan** of "missions": objectives with a mastery criterion, real resources, practices and projects adjusted to the user's level, written in their style. The structure of the plan (which skill, which week, how many minutes, which resource) is **deterministic**; the Learning Planner Agent only supplies the words.

## 2. Scope

**Includes**

- Domain that builds the skeleton of the plan.
- Learning Planner Agent for objectives, missions, instructions and notes for each week.
- Creation of the first Journey (`reason = initial`).
- `/journey` screen and "This week" widget on the dashboard.
- Marking activities as completed or skipped and updating the skill's progress.

**Does not include**

- Replanning after assessments or skips (SPEC-004); here skips are only **recorded**.
- Assessments (SPEC-004).
- Manual editing of the plan by the user.
- External calendars or reminders.

## 3. Design

### 3.1 Domain (`domain/journey`)

`buildJourneySkeleton({ gaps, learnerSkills, prerequisites, weeklyHours, resources, previousJourneys?, config })` returns weeks with **activity slots**. Rules:

1. **Candidates:** skills of the role with `gap > 0` and a status other than `acquired`.
2. **Effective priority:** the priority from SPEC-002 multiplied by `STRUGGLE_BOOST` if the skill is `struggling`.
3. **Study order:** topological according to prerequisites among candidates (a prerequisite with a gap goes before its dependents); ties by descending effective priority.
4. **Effort:** `gap * MINUTES_PER_LEVEL` minutes per skill.
5. **Weekly allocation:** budget per week = `weeklyHours * 60` minutes. The study order is traversed filling weeks up to `JOURNEY_HORIZON_WEEKS`. At most `WIP_LIMIT` distinct skills per week. A skill is not scheduled before its prerequisites with a gap are fully scheduled. What doesn't fit in the horizon stays in `backlog`.
6. **Slots:** each portion of a skill in a week is divided into activities of 15 minutes or multiples. Each skill has at least one `resource` slot and one `practice` slot; if `gap >= 2`, it includes a `project` slot in its last portion.
7. **Resources:** a `resource` slot takes a resource from `resources` whose level range covers the skill's current level (`level_min <= current level <= level_max`), preferring `verified = true` and the user's language. If there is no suitable resource, the slot becomes `practice` and is marked `noResource = true`.
8. **Reinforcement** (`reinforcement = true` for `struggling` skills): resources already used in previous journeys for that skill are avoided and a `type` different from the one used before is preferred. (Exercised in SPEC-004; here it must be implemented and tested.)

Each slot has a stable `slotId` within the journey.

**Example for tests** (`weeklyHours = 5` → 300 min/week; `MINUTES_PER_LEVEL = 300`; `WIP_LIMIT = 2`)

| Skill | Gap | Prerequisite | Effective priority | Effort |
|---|---|---|---|---|
| A | 1 | n/a | 10 | 300 |
| B | 2 | A | 8 | 600 |
| C | 1 | n/a | 9 | 300 |

Study order: among the skills whose prerequisites are already scheduled, the one with the highest effective priority is always chosen. First A (10; B still depends on A); then C (9) before B (8); finally B. Week 1 (300 min): A complete. Week 2: C complete. Weeks 3 and 4: B (300 each). B is not scheduled before A. No week exceeds 300 minutes or 2 skills.

### 3.2 Learning Planner Agent (`agents/planner`)

- **Input:**
  - `learner: { name, background, weeklyHours }`
  - `tutorStyle`
  - `skills`: list of `{ skillSlug, name, currentLevel, targetLevel, reinforcement, slots: [{ slotId, type, week, minutes, resource?: { title, type } }] }`
  - `changeContext?` (used by SPEC-004): `{ reason, changes }`
- **Output:**
  - `objectives`: list of `{ skillSlug, description (max. 250 characters), masteryCriteria (1 to 3 verifiable texts) }`
  - `activities`: list of `{ slotId, title (max. 80 characters), mission (2 to 3 sentences with narrative), instructions (for `practice` and `project`; concrete steps), successCriteria (1 sentence) }`
  - `weeklySummaries`: list of `{ week, headline, note }`
  - `changeExplanation?` (brief text, only with `changeContext`)
- **Validation in the service:**
  - Each `slotId` of the input appears **exactly once** in `activities`; unknown ones are discarded and missing ones invalidate the output.
  - Every `skillSlug` exists in the input.
  - The agent **cannot** change skills, weeks, minutes or resources. It never produces URLs: the link is taken from the catalog through the slot.
- **Prompt tone:** missions with brief narrative and variety of format (challenges, mini-projects, guiding questions), approachable and encouraging, adapted to the Tutor Style. `practice` and `project` must be suited to the current level, with a verifiable success criterion.

### 3.3 Skill progress (`domain/skill-state`)

`applyActivityCompletion(skillState, activity, currentGap, config)`:

- Adds `round(activity.minutes / (currentGap * MINUTES_PER_LEVEL) * 100)` to `progress`, with a maximum of 100.
- If the status was `available` and `progress > 0`, it becomes `in_progress`.
- `readyForAssessment` is a **derived** value: `progress >= 100`.
- **The level does not change** by completing activities (rule R-04).

### 3.4 Routes

| Route | Function |
|---|---|
| `POST /api/journey/generate` | Creates the first Journey: calculates the skeleton, calls the Planner Agent (**one** call), persists `objectives`, `journeys` and `activities`. If a current one already exists, responds 409 |
| `GET /api/journey` | Returns the current Journey with its weeks, activities, resources and objectives |
| `POST /api/activities/:id/complete` | Marks `done`, applies progress and returns the skill's updated state |
| `POST /api/activities/:id/skip` | Marks `skipped` and returns the accumulated count of skipped ones (without replanning yet) |

If the Planner Agent fails after the retry, the service generates a **minimal deterministic** plan (titles derived from the type and the skill, without narrative) and flags it so that it can be regenerated.

### 3.5 Interface

- **`/journey`:** tabs per week; each activity as a card (title, type with badge, minutes, narrative, instructions, success criterion, link to the resource if any, "Done" and "Skip" buttons). List of objectives with their mastery criterion. Weekly note from the agent.
- **Dashboard:** "This week" widget with the activities and progress.
- **First access:** if the learner has no Journey, the dashboard offers "Create my plan", which calls `/api/journey/generate` with a friendly loading state.
- Completed cards are dimmed; skipped ones are shown differentiated.

## 4. Acceptance criteria

1. After "Create my plan", there is a current Journey with activities in up to `JOURNEY_HORIZON_WEEKS` weeks.
2. No week exceeds the minutes budget or `WIP_LIMIT` skills, and no skill is scheduled before its prerequisites with a gap (verified with the test example).
3. Each `resource`-type activity links to a URL that **comes from the catalog**; no link is generated by the agent.
4. `objectives` contains, for each scheduled skill with a gap, a description and 1 to 3 mastery criteria.
5. Each `slotId` produces exactly one activity; an agent output with missing or surplus slots is rejected and the deterministic fallback is applied.
6. The text of the missions respects the Tutor Style (language and tone; verifiable with a fixture and with a manual test with another style).
7. Marking an activity as done updates the skill's `progress` according to the formula, moves it to `in_progress` if applicable and **does not modify the level**.
8. When `progress` reaches 100, the skill becomes "ready to assess" (visible indicator in the tree and in the journey).
9. Skipping an activity marks it as `skipped` and updates the skipped count; it does not replan yet.
10. Reloading `/journey` does not call the model again.
11. Works on the Vercel deployment and with `AI_MODE=fixtures`.

## 5. Required tests

- Unit tests of `buildJourneySkeleton`: example from the table, hours limit, `WIP_LIMIT`, prerequisites, `backlog`, skill without suitable resources (`noResource`) and reinforcement avoiding previous resources.
- Unit tests of `applyActivityCompletion`, including the cap of 100 and that the level does not change.
- Planner Agent contract: valid fixture, missing slot, unknown slot, invented URL in a text field (it is discarded or rejected).
- Browser verification: create plan, complete and skip activities, see the progress in the tree.

## 6. Notes for the agent

- The constants come from `domain/constants.ts`; do not repeat them in the code.
- Keep the mission cards visually appealing: they are the "playful" face of the product.
- Agent fixture: `data/fixtures/agents/planner.json` (with and without `changeContext`).
