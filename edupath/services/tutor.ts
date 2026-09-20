// services/tutor.ts
// Orchestration service for Tutor Agent (chat operation) (SPEC-005 §3.1, §4.3, §4.4)

import { getActiveLearner } from '@/lib/db/repositories/learners';
import { getRoleById } from '@/lib/db/repositories/roles';
import { getTutorStyle } from '@/lib/db/repositories/tutor-styles';
import { getSkillsByRole, getSkillBySlug } from '@/lib/db/repositories/skills';
import { getLearnerSkills } from '@/lib/db/repositories/learner-skills';
import { getActiveJourney } from '@/lib/db/repositories/journeys';
import { getActivitiesWithDetailsByJourney } from '@/lib/db/repositories/activities';
import { getNotebookById, getNotebooksBySkill } from '@/lib/db/repositories/notebooks';
import { determineEligibility } from '@/domain/assessment';
import { runTutorChat } from '@/agents/tutor/run';
import {
  TutorChatInput,
  TutorChatOutput,
  SuggestedAction,
} from '@/agents/tutor/schema';

export class TutorServiceError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code: string = 'TUTOR_ERROR'
  ) {
    super(message);
    this.name = 'TutorServiceError';
  }
}

export interface HandleTutorChatParams {
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  focusSkillSlug?: string;
  notebookIds?: string[];
}

export async function handleTutorChat(
  params: HandleTutorChatParams
): Promise<TutorChatOutput> {
  const { question, history = [], focusSkillSlug, notebookIds = [] } = params;

  // 1. Validate request
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new TutorServiceError('Question is required', 400, 'INVALID_QUESTION');
  }

  const trimmedQuestion = question.trim();
  if (trimmedQuestion.length > 1000) {
    throw new TutorServiceError('Question must not exceed 1000 characters', 400, 'QUESTION_TOO_LONG');
  }

  // 2. Load active learner profile
  const learner = await getActiveLearner();
  if (!learner) {
    throw new TutorServiceError('No active learner profile found. Complete onboarding first.', 404, 'NO_LEARNER');
  }

  if (!learner.target_role_id) {
    throw new TutorServiceError('Active learner has no target role specified', 400, 'NO_TARGET_ROLE');
  }

  const role = await getRoleById(learner.target_role_id);
  if (!role) {
    throw new TutorServiceError('Target role not found', 404, 'ROLE_NOT_FOUND');
  }

  // 3. Load tutor style
  const styleRecord = await getTutorStyle(learner.id);
  const tutorStyle = {
    language: styleRecord?.language ?? 'es',
    tone: styleRecord?.tone ?? 'cercano',
    detailLevel: styleRecord?.detail_level ?? 'equilibrado',
    useAnalogies: styleRecord?.use_analogies ?? true,
    freeInstructions: styleRecord?.free_instructions ?? '',
  };

  // 4. Load skills and skill states
  const roleSkills = await getSkillsByRole(role.id);
  const learnerSkills = await getLearnerSkills(learner.id);
  const learnerSkillMap = new Map(learnerSkills.map((ls) => [ls.skill_id, ls]));

  const snapshotSkills = roleSkills.map((rs) => {
    const ls = learnerSkillMap.get(rs.id);
    return {
      slug: rs.slug,
      name: rs.name,
      level: ls?.level ?? 0,
      requiredLevel: rs.required_level,
      verification: ls?.verification ?? 'self_reported',
      status: ls?.status ?? 'available',
      progress: ls?.progress ?? 0,
    };
  });

  // 5. Load active journey and current week
  const activeJourney = await getActiveJourney(learner.id);
  let currentWeek: { number: number; activities: Array<{ title: string; type: string; status: string; skillSlug: string }> } | null = null;
  let lastChange: { summary: string; changes: unknown } | null = null;

  if (activeJourney) {
    lastChange = {
      summary: activeJourney.summary,
      changes: activeJourney.changes,
    };

    const activities = await getActivitiesWithDetailsByJourney(activeJourney.id);
    if (activities.length > 0) {
      // Find current week: first week with pending activity, or week 1
      const pendingActivity = activities.find((a) => a.status === 'pending');
      const currentWeekNumber = pendingActivity ? pendingActivity.week : activities[0].week;

      const weekActivities = activities
        .filter((a) => a.week === currentWeekNumber)
        .map((a) => ({
          title: a.title,
          type: a.type,
          status: a.status,
          skillSlug: a.skill?.slug ?? '',
        }));

      currentWeek = {
        number: currentWeekNumber,
        activities: weekActivities,
      };
    }
  }

  // 6. Deterministic notebook context selection (SPEC-005 §3.3):
  // Rule 1: User explicitly provided notebookIds -> use up to 2 valid owned notebooks
  // Rule 2: If no notebookIds and focusSkillSlug -> fetch up to 2 most recent notebooks for that skill
  // Content truncated to 4000 chars each
  const selectedNotebooks: Array<{ title: string; content: string }> = [];

  if (Array.isArray(notebookIds) && notebookIds.length > 0) {
    const uniqueIds = Array.from(new Set(notebookIds)).slice(0, 2);
    for (const nbId of uniqueIds) {
      if (typeof nbId === 'string') {
        const nb = await getNotebookById(nbId, learner.id);
        if (nb) {
          selectedNotebooks.push({
            title: nb.title,
            content: nb.content.slice(0, 4000),
          });
        }
      }
    }
  } else if (focusSkillSlug && typeof focusSkillSlug === 'string') {
    const focusSkill = await getSkillBySlug(focusSkillSlug);
    if (focusSkill) {
      const relatedNotebooks = await getNotebooksBySkill(learner.id, focusSkill.id, 2);
      for (const nb of relatedNotebooks) {
        selectedNotebooks.push({
          title: nb.title,
          content: nb.content.slice(0, 4000),
        });
      }
    }
  }

  // 7. Format history: up to last 10 turns, content max 1000 chars
  const formattedHistory = (Array.isArray(history) ? history : [])
    .slice(-10)
    .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
    .map((h) => ({
      role: h.role,
      content: h.content.slice(0, 1000),
    }));

  // 8. Assemble Agent Input
  const agentInput: TutorChatInput = {
    tutorStyle,
    snapshot: {
      name: learner.name,
      role: role.name,
      weeklyHours: learner.weekly_hours,
      skills: snapshotSkills,
      currentWeek,
      lastChange,
    },
    notebooks: selectedNotebooks,
    history: formattedHistory,
    question: trimmedQuestion,
  };

  // 9. Call Tutor Agent
  let agentOutput: TutorChatOutput;
  try {
    agentOutput = await runTutorChat(agentInput);
  } catch (err: unknown) {
    throw new TutorServiceError(
      `Tutor agent temporarily unavailable: ${err instanceof Error ? err.message : String(err)}`,
      502,
      'AI_ERROR'
    );
  }

  // 10. Validate and sanitize suggestedAction (SPEC-005 §3.1, §4.4)
  // - skillSlug must correspond to an existing catalog skill
  // - start_assessment is valid ONLY when SPEC-004 says the skill is eligible
  // - notebookId must belong to active learner
  // - invalid suggestedAction is discarded without invalidating the whole answer
  let sanitizedAction: SuggestedAction | undefined = undefined;

  if (agentOutput.suggestedAction) {
    const action = agentOutput.suggestedAction;

    if (action.type === 'start_assessment') {
      if (action.skillSlug) {
        const skill = await getSkillBySlug(action.skillSlug);
        if (skill) {
          const rs = roleSkills.find((r) => r.id === skill.id);
          const ls = learnerSkills.find((l) => l.skill_id === skill.id);
          if (rs && ls) {
            const eligibility = determineEligibility(
              {
                level: ls.level,
                verification: ls.verification,
                progress: ls.progress,
                status: ls.status,
              },
              rs.required_level
            );
            if (eligibility.eligible) {
              sanitizedAction = {
                type: 'start_assessment',
                skillSlug: skill.slug,
              };
            }
          }
        }
      }
    } else if (action.type === 'open_skill') {
      if (action.skillSlug) {
        const skill = await getSkillBySlug(action.skillSlug);
        if (skill) {
          sanitizedAction = {
            type: 'open_skill',
            skillSlug: skill.slug,
          };
        }
      }
    } else if (action.type === 'open_notebook') {
      if (action.notebookId) {
        const nb = await getNotebookById(action.notebookId, learner.id);
        if (nb) {
          sanitizedAction = {
            type: 'open_notebook',
            notebookId: nb.id,
          };
        }
      }
    } else if (action.type === 'open_journey') {
      sanitizedAction = {
        type: 'open_journey',
      };
    }
  }

  return {
    answer: agentOutput.answer,
    followUps: agentOutput.followUps,
    suggestedAction: sanitizedAction,
  };
}
