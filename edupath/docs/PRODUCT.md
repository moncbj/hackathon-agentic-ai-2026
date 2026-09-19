# EduPath: PRODUCT.md

> **Status:** v0.1, product source of truth. Lives in `/docs/PRODUCT.md`.
> **Related documents (to be created):** `DOMAIN.md`, `ARCHITECTURE.md`, `UX.md`, `AGENTS.md`, `EVALUATION.md`, `ROADMAP.md`.
> **Conventions:** the text is in Spanish; domain terms are kept in English (Learner Profile, Skill State, Assessment, etc.) so that they match the code and the other documents. Decisions marked as *provisional* are closed in `DOMAIN.md`.

---

## 1. Summary

EduPath is an AI-powered personalized learning platform. It takes what a person says they know, compares it with what the role they aspire to demands, builds a learning path tailored to them and **truly verifies** whether they are learning. As the person progresses, the path replans itself.

**In one sentence:** a living skill map that adjusts to each person's real progress, instead of a generic curriculum that is the same for everyone.

---

## 2. Problem

Many people know what career or skill they want to pursue, but don't know what they need to learn **next**.

- Resources are scattered: courses, videos, articles, documentation, projects and practice platforms.
- A generic curriculum is followed even though each person's skills, goals and gaps are different.
- Time is lost searching for resources and repeating topics that are already mastered.
- It is hard to turn learning into a structured action plan sustained over time.
- Nobody contrasts what the person *believes* they know with what they *actually* know.

---

## 3. Vision and value proposition

| Differentiator | What it means for the user |
|---|---|
| **Adaptive path** | The plan changes with every assessment and activity; there is no fixed curriculum |
| **Verified level** | The system doesn't settle for what the user declares: it progressively checks it with assessments |
| **Tutor tailored to you** | Explains in the language, tone and style the user prefers, and proposes creative and playful activities |
| **Visual skill map** | A dynamic, video-game-style skill tree that shows what they master, what is in progress and what it unlocks next |

---

## 4. Target users

**Primary users (hypotheses to validate):**

- Students and recent graduates who aim for a specific role and don't know where to go next.
- People in career transition who have partial skills and want to avoid repeating what they already know.
- Self-taught learners with scattered resources who need structure.

**Example persona for the demo (fictional):** a final-year student with programming foundations who aspires to a data analysis role, has 8 hours a week available and prefers explanations with everyday analogies.

---

## 5. Product principles

1. **The initial profile is self-declared and assumed correct.** The user doesn't go through a long exam on entry: the system starts from what they declare and **verifies it progressively** with assessments and completed activities.
2. **The path is never fixed.** Every assessment, activity or goal change can replan the plan.
3. **The deterministic takes precedence over the generated.** The rules for level updates, gap calculation and replanning are predictable and testable. AI generates content (questions, explanations, activities, narrative); it does not decide on the user's state.
4. **Agents propose; domain logic decides.** Agents return structured outputs and do not directly modify the data.
5. **Approachable and playful.** The tone is that of a guide who accompanies, not an examiner.
6. **Transparent.** The user can see why the system recommends something to them and why their plan changed.
7. **Simple.** The MVP must be maintainable by a small team and coding agents. No technology, infrastructure or complexity is introduced just because it is customary.
8. **No evidence/provenance system in the MVP.** The Skill State and the assessment history are enough. It is only reconsidered if another part of the architecture requires it.

---

## 6. Core product cycle

```
Learner Profile
   → Initial Skills (self-declared)
      → Target Role
         → Skill Gap Analysis
            → Learning Objectives
               → Personalized Learning Journey
                  → Activities
                     → Assessment
                        → Skill State Update
                           → Adaptive Replanning ──┐
                                                    │
        (returns to Skill Gap Analysis and Journey) ◄───┘
```

| Step | Description | Who acts |
|---|---|---|
| **Learner Profile** | User data: goal, education, available hours, learning style | User + Profile Agent |
| **Initial Skills** | Self-declared skills with a level; they can be pre-filled from a CV, portfolio or certificates and the user confirms them | User + Profile Agent |
| **Target Role** | Role the user aspires to, with its set of required skills (curated catalog) | User + catalog |
| **Skill Gap Analysis** | Difference between current level and required level, prioritized | Deterministic logic + Gap Analysis Agent (explanation) |
| **Learning Objectives** | Each gap becomes objectives with a mastery criterion | Learning Planner Agent |
| **Personalized Learning Journey** | Weekly plan of "missions" adjusted to the available hours | Learning Planner Agent + deterministic logic |
| **Activities** | Resources, practices and projects according to level | Learning Planner Agent + Tutor Agent |
| **Assessment** | Independent evaluation that measures the real level | Assessment Agent |
| **Skill State Update** | The result updates the skill's level, verification and status | Domain logic |
| **Adaptive Replanning** | The plan adjusts according to results, progress and difficulties | Deterministic logic + Learning Planner Agent |

---

## 7. Product capabilities

**Priorities:** **P0** = needed for the hackathon demo (a day and a half, two people); **P1** = later complete MVP; **P2** = future.

| ID | Capability | Description | Priority |
|---|---|---|---|
| F-01 | **Onboarding** | Form for goal, target role, education, self-declared skills with level, hours per week | P0 |
| F-02 | **Document analysis** | The user uploads a CV, portfolio, certificates or project descriptions; the Profile Agent proposes skills and levels that the user confirms or edits | P0 (text or simple PDF) |
| F-03 | **Role and skill catalog** | Curated data: skills per role, required level, weight and prerequisites | P0 (1 or 2 roles) |
| F-04 | **Skill Gap Analysis** | Deterministic calculation of gaps and priority; the Gap Analysis Agent provides the natural-language explanation | P0 |
| F-05 | **Learning Objectives** | Objectives per gap, with a verifiable mastery criterion | P0 |
| F-06 | **Personalized Learning Journey** | Weekly plan of missions in line with the available hours | P0 |
| F-07 | **Recommended resources** | Courses, videos, articles, documentation and projects per skill, from a curated catalog with verified links | P0 |
| F-08 | **Activities and projects** | Practice tasks and project ideas according to level, presented in a creative and playful way | P0 |
| F-09 | **Activity tracking** | The user marks activities as completed; the system records the progress | P0 |
| F-10 | **Assessments** | Assessments generated and graded by the Assessment Agent, with a rubric and structured output | P0 |
| F-11 | **Skill State Update** | Deterministic update of level, verification and status after each assessment | P0 |
| F-12 | **Adaptive Replanning** | Automatic replanning after assessments, skipped activities or goal changes | P0 |
| F-13 | **Difficulty detection** | Flags skills in which the user keeps failing, with more reinforcement in the plan | P0 (rule-based) |
| F-14 | **Dashboard with skill tree** | Central view: skill map, this week's missions, alerts and feedback | P0 |
| F-15 | **Personalized tutor** | Natural-language questions about the path and the content, in the user's style | P0 (simple version) |
| F-16 | **Tutor Style** | Selector for language, tone, level of detail and analogies, plus free-form natural-language instructions | P0 (low-cost version) |
| F-17 | **Progress reports** | Acquired skills, in progress, remaining gaps and next steps | P0 on demand, P1 periodic |
| F-18 | **Notebooks** | Each notebook behaves like a subject and is associated with catalog or custom skills; the tutor uses its content | P1 (minimal P0: text as context for a skill) |
| F-19 | **Real skill taxonomies** | Import open catalogs (for example ESCO or O*NET) | P2 |
| F-20 | **Multi-user with full authentication** | Accounts, sessions and user management | P1 |

### Traceability with the challenge brief

| Brief requirement | Capabilities |
|---|---|
| Enter skills, experience, target role and goal | F-01 |
| Analyze CVs, portfolios, certificates or project descriptions | F-02 |
| Identify gaps against the role | F-03, F-04 |
| Split the gaps into learning objectives | F-05 |
| Recommend resources per gap | F-07 |
| Personalized weekly plan | F-06 |
| Practice tasks and project ideas according to level | F-08 |
| Tracking and dynamic plan updates | F-09, F-11, F-12 |
| Identify persistent difficulties | F-13 |
| Periodic progress reports | F-17 |
| Natural-language questions about the path | F-15 |

---

## 8. Skill State and progress rules (provisional)

The exact rules, formulas and thresholds are closed in `DOMAIN.md`. Here the **product intent** is set.

### 8.1 Level scale (proposal)

| Level | Meaning |
|---|---|
| 0 | No knowledge |
| 1 | Basic |
| 2 | Intermediate |
| 3 | Advanced |
| 4 | Expert |

### 8.2 Attributes of a user's skill

| Attribute | Values |
|---|---|
| **Current level** | 0 to 4 |
| **Verification** | `self_reported` (declared) or `verified` (checked by an assessment) |
| **Status** | `locked` (pending prerequisites), `available`, `in_progress`, `acquired`, `struggling` |
| **Progress** | Advancement in activities toward becoming "ready to assess" |

The difference between `self_reported` and `verified` is central to the product and to the demo.

### 8.3 Product business rules

| ID | Rule |
|---|---|
| R-01 | The initial profile is accepted as the user declares it and is used to calculate the gaps |
| R-02 | Gap of a skill = level required by the role minus current level (never negative). Priority combines weight in the role, size of the gap and prerequisites |
| R-03 | A skill declared at a sufficient level does not generate a gap, but remains **unverified**. The system proposes assessing it, starting with those of highest weight in the role |
| R-04 | Completing activities advances progress and leaves the skill "ready to assess", but **does not change the level by itself** |
| R-05 | The level only changes as a result of an assessment. If the result confirms or exceeds the declared level, it is kept or raised and becomes `verified`. If it is lower, the level drops to the measured one and becomes `verified`. In progress assessments (after studying) the level never drops below the current one; in verification assessments it can drop |
| R-06 | After a configurable number of consecutive failed assessments on the same skill (default 2), the skill becomes `struggling` |
| R-07 | An `acquired` skill unlocks those that depend on it |
| R-08 | Replanning is triggered by: an assessment result, skipped or late activities, a change of target role or available hours |
| R-09 | In replanning, `struggling` skills receive reinforcement with a different resource format; what is already mastered is trimmed; what has been unlocked is incorporated |
| R-10 | Agent outputs must comply with a structured schema; if they don't, a retry is made or a fallback is applied and the user's state is not modified |

---

## 9. Agents from the product perspective

The technical contracts (inputs, outputs, schemas) are defined in `AGENTS.md`.

| Agent | Purpose | When it acts | What it can NOT do |
|---|---|---|---|
| **Profile Agent** | Extract skills, levels and context from the form and documents; build the tutor profile | Onboarding and when the user uploads documents | Accept levels on its own: the user confirms |
| **Gap Analysis Agent** | Explain the gaps and their priority in clear language; help map freely written skills to those in the catalog | After the diagnosis and every replanning | Calculate the gap (it is deterministic) |
| **Learning Planner Agent** | Turn gaps into objectives, missions, activities and project ideas according to level and style | When creating the plan and when replanning | Change levels or the status of skills |
| **Assessment Agent** | Act as an **independent auditor**: generate assessments and grade them with a rubric | When a skill is ready to assess or the user requests it | Write to the database or apply the result directly; converse in a complacent tone |
| **Tutor Agent** | Answer questions about the path and the content, explain in the user's style, draw on the notebooks | At any time, on demand | Modify levels, skill status or assessment results |

**Separation rule:** the Assessment Agent is independent of the Tutor Agent. The tutor accompanies; the auditor measures. Only the result of an assessment, applied by the domain logic, can change the level of a skill.

---

## 10. Experience (intent)

The details live in `UX.md`. Pillars:

1. **Approachable:** natural language, guide tone, customizable.
2. **Playful:** activities are framed as missions with narrative and variety of formats, not as cold lists.
3. **Visual:** the skill tree is the lead screen.
4. **Integrated feedback:** every action has an immediate response (a node that changes state, a message from the tutor, a visible adjustment in the plan).

**MVP screens:** onboarding, dashboard (skill tree, this week's missions, alerts), skill detail, activity, assessment, notebook, report and tutor chat.

**Skill tree (intent):** nodes connected by prerequisites; color and shape according to status (locked, available, in progress, acquired, struggling) and a visible mark for `self_reported` versus `verified`; animation when a node changes state.

---

## 11. Notebooks and personalization

**Notebooks:** a space where the user gathers the material for a subject (notes, documents, links). Each notebook is associated with one or more skills, either from the catalog or created by the user. The Tutor Agent answers based on that content. Priority P1, with a minimal version in P0.

**Tutor Style:** a set of preferences that the user defines in natural language or with selectors.

| Dimension | Examples |
|---|---|
| Language | Spanish, English |
| Tone | Formal, friendly, motivating |
| Level of detail | Summarized or in-depth |
| Format | Analogies, steps, examples, guiding questions |
| Free-form instructions | "Explain it to me with cooking examples" |

The Tutor Style is applied to the Tutor Agent and also to how missions and activities are written.

---

## 12. Scope

### Within the MVP

Complete cycle: profile, skills, gaps, objectives, weekly plan, activities, assessments, state update and replanning, with a visual dashboard, customizable tutor and progress report.

### Outside the MVP (non-goals)

- Evidence or provenance system for every claim about a skill.
- Microservices, queues and heavy asynchronous processing.
- Additional agent orchestration frameworks, unless a real need is demonstrated.
- Native mobile application.
- Course marketplace, payments or official certificates.
- Social or competitive features between users.
- Complete skill taxonomies (ESCO, O*NET) in the first version.

### Hackathon cut (a day and a half, two people)

| In | Simplified | Left out |
|---|---|---|
| Onboarding, catalog for one role, gaps, weekly plan, skill tree, assessment with state update and replanning | Tutor Style with selector and text field; notebooks as text associated with a skill; on-demand report; chat with state in the prompt | Full login, multi-user, taxonomy import, automatic periodic reports |

A single demo user and one target role with its preloaded catalog.

---

## 13. Product decisions

Each decision indicates alternatives considered and why it fits a product built with coding agents.

### D-01. Self-declared profile, assumed correct at the start

- **Decision:** the system starts from what the user declares and verifies it progressively.
- **Alternatives:** an extensive level test before starting; inferring the level from the CV alone.
- **Why it fits:** it reduces startup friction, simplifies the initial flow and leaves verification as a natural process of the cycle, with less surface to implement and test.

### D-02. No evidence or provenance system in the MVP

- **Decision:** the skill's state and the assessment history are sufficient. Declared versus verified level is represented with a verification attribute.
- **Alternatives:** an evidence entity with origin and provenance for each claim.
- **Why it fits:** fewer entities and relationships to keep in sync. It is only reconsidered if a real traceability need appears.

### D-03. Assessment Agent independent of the Tutor Agent

- **Decision:** two agents with separate prompts, context and responsibilities.
- **Alternatives:** having the tutor assess while explaining.
- **Why it fits:** a kind tutor tends to overrate answers. Separating roles makes the assessments more credible and each agent easier to test in isolation.

### D-04. Deterministic logic for state and replanning

- **Decision:** explicit rules (section 8) decide levels, statuses, priorities and replanning triggers. AI generates content.
- **Alternatives:** letting an LLM decide the level and the next step.
- **Why it fits:** predictable, testable and reproducible behavior, something that coding agents can verify with automated tests.

### D-05. Curated catalog of roles and skills

- **Decision:** seed data reviewed by the team.
- **Alternatives:** having the LLM generate the requirements for each role on each use; importing an external taxonomy from the start.
- **Why it fits:** consistency across users and across runs, and less surface. Taxonomy import remains as an extension.

### D-06. Curated and verified resources

- **Decision:** recommendations come from a catalog with verified links.
- **Alternatives:** having the LLM freely propose resources.
- **Why it fits:** models can invent links; recommending nonexistent resources destroys trust in the product.

### D-07. The level only changes through assessment

- **Decision:** completing activities advances progress but does not raise the level.
- **Alternatives:** giving partial level credit for each activity.
- **Why it fits:** it avoids level inflation and keeps a single point of change, easy to reason about and to test.

### D-08. The skill tree is the central screen

- **Decision:** the skill map is the axis of the experience and of the visual differentiator.
- **Alternatives:** a task list or a simple board.
- **Why it fits:** it shows the state of the cycle at a glance, makes the adaptation visible and serves as the basis for the demo.

---

## 14. Success metrics

**Hackathon:**

- The complete cycle works on the deployed URL.
- Star scenario reproducible without failures: load the profile, see the tree, fail an assessment and see how the plan changes by itself.

**Product (hypotheses):**

| Metric | What it indicates |
|---|---|
| Time to first plan | Onboarding friction |
| Activities completed per week | Usefulness and feasibility of the plan |
| Percentage of verified skills | Effectiveness of the assessment cycle |
| Frequency of useful replannings | Adaptability |
| Weekly retention | Sustained value |
| Satisfaction with resources and explanations | Quality of personalization |

---

## 15. Demo scenario

1. The example person's profile and their CV are loaded; the skill tree lights up with the declared skills.
2. The system shows the gaps against the role and generates the week's plan with missions.
3. The user completes an activity and takes the assessment for a declared skill.
4. **Star moment:** the assessment result is low. The node becomes `verified` at a level lower than the declared one, and the week's plan **changes by itself** and incorporates reinforcement.
5. The user asks the tutor why their plan changed and receives the explanation in their chosen style.
6. The progress report is generated.

A **backup video** is also prepared in case the live connection fails.

---

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Users overestimate their skills | Progressive verification, starting with those of highest weight in the role (R-03) |
| The LLM invents resources or links | Curated catalog and URL verification (D-06) |
| Poorly calibrated assessments | Explicit rubrics, testing strategy in `EVALUATION.md` and configurable thresholds |
| Model outputs with invalid format | Structured schemas and validation; the state does not change on an invalid output (R-10) |
| Excessive scope for the available time | Priorities P0 to P2 and explicit hackathon cut |
| Latency of model calls | Bounded prompts, loading states in the interface and preloaded demo data |
| Deployment failures on demo day | Deploy a minimal connected flow from the first hours and record a backup video |

---

## 17. Open questions

1. Is the 0 to 4 level scale the final one?
2. Which role or roles are preloaded first and how many skills does each have?
3. Which assessment types come first: multiple choice, open-ended, practical exercise?
4. What is the passing threshold and the number of failures to mark `struggling`?
5. Is the product offered only in Spanish, or with language support from the start?
6. Which curated resource catalog will be used as a starting point?

---

## 18. Glossary

| Term | Definition |
|---|---|
| **Learner Profile** | User data and preferences: goal, education, hours, style |
| **Skill** | Catalog skill, with prerequisites and weight per role |
| **Skill State** | Level, verification, status and progress of a skill for a user |
| **Self-reported / Verified** | Level declared by the user versus level checked by an assessment |
| **Target Role** | Role the user aspires to, with its required skills |
| **Skill Gap** | Difference between the required level and the current level |
| **Learning Objective** | Concrete learning goal derived from a gap |
| **Journey** | Personalized learning plan, organized by weeks |
| **Mission / Activity** | Unit of work of the plan: resource, practice or project |
| **Assessment** | Evaluation that measures the real level of a skill |
| **Replanning** | Adjustment of the plan due to results, progress or changes in context |
| **Tutor Style** | The user's explanation preferences |
| **Notebook** | Study material space that behaves like a subject associated with skills |

---

## 19. Initial specs

The specs live in `/docs/specs/` and are the bridge between this document and the implementation. Each one must be read together with this `PRODUCT.md` and with `specs/README.md`, which sets the cross-cutting rules, the repository structure, the environment variables, the common Definition of Done and the **provisional domain constants** (scale, passing and difficulty thresholds, plan limits). Those constants answer open question 4 of section 17 as long as `DOMAIN.md` is not closed.

| Spec | Name | Capabilities | Depends on |
|---|---|---|---|
| SPEC-000 | Foundation, data and deployment | Foundation for everything | n/a |
| SPEC-001 | Onboarding and Learner Profile | F-01, F-02, F-16 | 000 |
| SPEC-002 | Skill Gap Analysis and skill tree | F-03, F-04, F-14 | 000, 001 |
| SPEC-003 | Objectives, weekly Journey and activities | F-05 to F-09 | 002 |
| SPEC-004 | Assessment, Skill State and replanning | F-10 to F-13 | 003 |
| SPEC-005 | Tutor, report and minimal notebook | F-15, F-17, F-18 | 001 (partial 004) |

**Implementation order:** 000, 001, 002, 003, 004 and 005. If time runs short, cut from the end of SPEC-005 (notebook first, then report); SPEC-004 is not cut because it contains the differentiator and the star scenario of the demo.
