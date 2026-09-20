// services/journey.ts
// Service for deterministic journey generation, learning planner agent coordination, and activity tracking (SPEC-003)

import { getActiveLearner, getLearnerById } from '@/lib/db/repositories/learners';
import { getRoleById } from '@/lib/db/repositories/roles';
import { getSkillsByRole } from '@/lib/db/repositories/skills';
import { getLearnerSkills, updateLearnerSkillProgress } from '@/lib/db/repositories/learner-skills';
import { getPrerequisitesForSkills } from '@/lib/db/repositories/prerequisites';
import { getTutorStyle } from '@/lib/db/repositories/tutor-styles';
import { getResourcesForSkills } from '@/lib/db/repositories/resources';
import {
  getActiveJourney,
  getAllJourneysForLearner,
  createJourney,
} from '@/lib/db/repositories/journeys';
import {
  createObjectives,
  getObjectivesByLearner,
  CreateObjectiveInput,
} from '@/lib/db/repositories/objectives';
import {
  createActivities,
  getActivitiesWithDetailsByJourney,
  getActivityById,
  updateActivityStatus,
  getSkippedActivitiesCount,
  ActivityWithDetails,
  CreateActivityInput,
} from '@/lib/db/repositories/activities';
import { computeGapAnalysis } from '@/domain/gaps';
import {
  buildJourneySkeleton,
  JourneySkeleton,
} from '@/domain/journey';
import { applyActivityCompletion, UpdatedSkillProgress } from '@/domain/skill-state';
import { runPlannerAgent } from '@/agents/planner/run';
import { PlannerAgentInput, PlannerAgentOutput } from '@/agents/planner/schema';

export class JourneyServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NO_LEARNER'
      | 'NO_TARGET_ROLE'
      | 'ROLE_NOT_FOUND'
      | 'JOURNEY_EXISTS'
      | 'NO_ACTIVE_JOURNEY'
      | 'ACTIVITY_NOT_FOUND'
      | 'NOT_OWNER'
      | 'INTERNAL_ERROR',
    public readonly status: number
  ) {
    super(message);
    this.name = 'JourneyServiceError';
  }
}

export interface JourneyActivityView {
  id: string;
  objectiveId: string;
  skillId: string;
  skillSlug: string;
  skillName: string;
  week: number;
  type: 'resource' | 'practice' | 'project';
  title: string;
  mission: string;
  instructions: string;
  successCriteria: string;
  minutes: number;
  status: 'pending' | 'done' | 'skipped';
  completedAt: string | null;
  resource?: {
    id: string;
    title: string;
    url: string;
    type: string;
    language: string;
    verified: boolean;
  } | null;
  skill: {
    id: string;
    slug: string;
    name: string;
    progress: number;
    status: string;
    readyForAssessment: boolean;
  };
}

export interface JourneyWeekView {
  number: number;
  headline: string;
  note: string;
  totalMinutes: number;
  activities: JourneyActivityView[];
}

export interface JourneyObjectiveView {
  id: string;
  skillId: string;
  skillSlug?: string;
  skillName?: string;
  description: string;
  criteria: string[];
  targetLevel: number;
  status: string;
}

export interface JourneyResponse {
  journey: {
    id: string;
    version: number;
    isCurrent: boolean;
    reason: string;
    summary: string;
    changes: Record<string, unknown>;
    createdAt: string;
  };
  weeks: JourneyWeekView[];
  objectives: JourneyObjectiveView[];
  stats: {
    totalActivities: number;
    completedActivities: number;
    skippedActivities: number;
    totalMinutes: number;
    completedMinutes: number;
  };
}

export interface CompleteActivityResponse {
  success: boolean;
  activity: {
    id: string;
    status: 'done';
    completedAt: string | null;
  };
  skill: UpdatedSkillProgress;
}

export interface SkipActivityResponse {
  success: boolean;
  activity: {
    id: string;
    status: 'skipped';
  };
  skippedCount: number;
}

/**
 * Validates agent output strictly against deterministic skeleton requirements:
 * - Every expected slotId must appear exactly once
 * - Unknown slotIds are rejected
 * - SkillSlugs must exist in scheduled skills
 * - Text constraints are checked
 */
function validatePlannerAgentOutput(
  output: PlannerAgentOutput,
  skeleton: JourneySkeleton
): boolean {
  const allSlots = skeleton.weeks.flatMap((w) => w.slots);
  const expectedSlotIds = new Set(allSlots.map((s) => s.slotId));
  const seenSlotIds = new Set<string>();

  for (const act of output.activities) {
    if (!expectedSlotIds.has(act.slotId)) {
      return false;
    }
    if (seenSlotIds.has(act.slotId)) {
      return false; // duplicate slotId
    }
    seenSlotIds.add(act.slotId);

    if (act.title.length > 80) {
      return false;
    }
  }

  // All expected slot IDs must be present
  if (seenSlotIds.size !== expectedSlotIds.size) {
    return false;
  }

  const scheduledSlugs = new Set(skeleton.scheduledSkills.map((s) => s.skillSlug));
  for (const obj of output.objectives) {
    if (!scheduledSlugs.has(obj.skillSlug)) {
      return false;
    }
    if (obj.description.length > 250) {
      return false;
    }
    if (obj.masteryCriteria.length === 0 || obj.masteryCriteria.length > 3) {
      return false;
    }
  }

  return true;
}

/**
 * Builds the required deterministic minimum fallback when the Planner Agent
 * is unavailable, times out, or produces invalid output.
 * Preserves exact deterministic decisions, skill, week, minutes, and resources.
 */
function buildDeterministicMinimumFallback(
  skeleton: JourneySkeleton
): PlannerAgentOutput {
  const objectives = skeleton.scheduledSkills.map((s) => ({
    skillSlug: s.skillSlug,
    description: `Master the ${s.name} skill to reach target level ${s.targetLevel}.`.slice(0, 250),
    masteryCriteria: [
      `Complete scheduled activities for ${s.name}`,
      `Demonstrate practical understanding of key concepts`,
    ],
  }));

  const activities = skeleton.weeks.flatMap((w) =>
    w.slots.map((slot) => {
      let title = '';
      if (slot.type === 'resource') {
        const resTitle = slot.resource?.title ?? 'Key concepts';
        title = `Learn ${slot.skillSlug}: ${resTitle}`;
      } else if (slot.type === 'practice') {
        title = `Guided practice for ${slot.skillSlug}`;
      } else {
        title = `Application project for ${slot.skillSlug}`;
      }
      if (title.length > 80) {
        title = title.slice(0, 77) + '...';
      }

      return {
        slotId: slot.slotId,
        title,
        mission: `Complete the ${slot.type} activity for the ${slot.skillSlug} skill.`,
        instructions: `Spend ${slot.minutes} minutes working on concepts and exercises for ${slot.skillSlug}.`,
        successCriteria: `Complete the work session and review the learned concepts.`,
      };
    })
  );

  const weeklySummaries = skeleton.weeks.map((w) => {
    const distinctNames = Array.from(new Set(w.slots.map((s) => s.skillSlug)));
    return {
      week: w.weekNumber,
      headline: `Week ${w.weekNumber}: Focus on ${distinctNames.join(', ')}`.slice(0, 80),
      note: `Estimated total dedication: ${w.totalMinutes} minutes across ${w.slots.length} activities.`,
    };
  });

  return {
    objectives,
    activities,
    weeklySummaries,
  };
}

/**
 * Generates the initial journey for the active learner.
 * Follows SPEC-003 execution flow:
 * 1. Load active learner
 * 2. Load role and skill data
 * 3. Compute SPEC-002 gaps
 * 4. Construct deterministic journey skeleton
 * 5. Check whether active journey already exists (return 409 if true)
 * 6. Invoke Planner Agent exactly once
 * 7. Validate output, fallback deterministically if needed
 * 8. Persist objectives, journey, activities
 * 9. Return the created journey
 */
export async function generateInitialJourney(learnerId?: string): Promise<JourneyResponse> {
  const learner = learnerId ? await getLearnerById(learnerId) : await getActiveLearner();
  if (!learner) {
    throw new JourneyServiceError(
      'No active learner profile found. Complete onboarding first.',
      'NO_LEARNER',
      404
    );
  }

  if (!learner.target_role_id) {
    throw new JourneyServiceError(
      'Active learner has no target role specified',
      'NO_TARGET_ROLE',
      400
    );
  }

  const role = await getRoleById(learner.target_role_id);
  if (!role) {
    throw new JourneyServiceError(
      `Target role "${learner.target_role_id}" not found`,
      'ROLE_NOT_FOUND',
      404
    );
  }

  // Check if an active journey already exists
  const existingActive = await getActiveJourney(learner.id);
  if (existingActive) {
    throw new JourneyServiceError(
      'An active learning journey already exists for this learner',
      'JOURNEY_EXISTS',
      409
    );
  }

  // Load skills, learner skills, prerequisites, tutor style, resources, and previous journeys
  const roleSkills = await getSkillsByRole(learner.target_role_id);
  const skillIds = roleSkills.map((rs) => rs.id);
  const learnerSkills = await getLearnerSkills(learner.id);
  const prerequisites = await getPrerequisitesForSkills(skillIds);
  const tutorStyle = await getTutorStyle(learner.id);
  const resources = await getResourcesForSkills(skillIds);
  const previousJourneys = await getAllJourneysForLearner(learner.id);

  // Compute gap analysis
  const gapAnalysis = computeGapAnalysis({
    roleSkills: roleSkills.map((rs) => ({
      skillId: rs.id,
      skillSlug: rs.slug,
      name: rs.name,
      requiredLevel: rs.required_level,
      weight: rs.weight,
    })),
    learnerSkills: learnerSkills.map((ls) => ({
      skillId: ls.skill_id,
      level: ls.level,
      status: ls.status,
      verification: ls.verification,
      progress: ls.progress,
      consecutiveFailures: ls.consecutive_failures,
    })),
    prerequisites: prerequisites.map((p) => ({
      skillId: p.skillId,
      prerequisiteSkillId: p.prerequisiteSkillId,
    })),
  });

  // Construct deterministic journey skeleton
  const skeleton = buildJourneySkeleton({
    gaps: gapAnalysis,
    learnerSkills: learnerSkills.map((ls) => ({
      skillId: ls.skill_id,
      level: ls.level,
      status: ls.status,
      verification: ls.verification,
    })),
    prerequisites,
    weeklyHours: learner.weekly_hours,
    resources,
    previousJourneys: previousJourneys.map((j) => ({
      id: j.id,
      activities: [],
    })),
    config: {
      learnerLanguage: tutorStyle?.language ?? 'es',
    },
  });

  // Prepare input for Learning Planner Agent
  const plannerInput: PlannerAgentInput = {
    learner: {
      name: learner.name,
      background: learner.background,
      weeklyHours: learner.weekly_hours,
    },
    tutorStyle: {
      language: tutorStyle?.language ?? 'es',
      tone: tutorStyle?.tone ?? 'cercano',
      detailLevel: tutorStyle?.detail_level ?? 'equilibrado',
      useAnalogies: tutorStyle?.use_analogies ?? true,
      freeInstructions: tutorStyle?.free_instructions ?? '',
    },
    skills: skeleton.scheduledSkills.map((s) => ({
      skillSlug: s.skillSlug,
      name: s.name,
      currentLevel: s.currentLevel,
      targetLevel: s.targetLevel,
      reinforcement: s.reinforcement,
      slots: s.slots.map((slot) => ({
        slotId: slot.slotId,
        type: slot.type,
        week: slot.week,
        minutes: slot.minutes,
        resource: slot.resource
          ? {
              title: slot.resource.title,
              type: slot.resource.type,
            }
          : undefined,
      })),
    })),
  };

  // Invoke Planner Agent exactly once, fallback if needed
  let agentOutput: PlannerAgentOutput | null = null;
  let isFallback = false;

  if (skeleton.scheduledSkills.length > 0) {
    try {
      const result = await runPlannerAgent(plannerInput);
      if (validatePlannerAgentOutput(result, skeleton)) {
        agentOutput = result;
      } else {
        isFallback = true;
        agentOutput = buildDeterministicMinimumFallback(skeleton);
      }
    } catch {
      isFallback = true;
      agentOutput = buildDeterministicMinimumFallback(skeleton);
    }
  } else {
    agentOutput = {
      objectives: [],
      activities: [],
      weeklySummaries: [],
    };
  }

  // 10. Persist:
  // a) Objectives
  const objectivesToInsert: CreateObjectiveInput[] = skeleton.scheduledSkills.map((s) => {
    const matchedObjective = agentOutput?.objectives.find((obj) => obj.skillSlug === s.skillSlug);
    return {
      skillId: s.skillId,
      description:
        matchedObjective?.description ??
        `Master the ${s.name} skill to reach target level ${s.targetLevel}.`,
      masteryCriteria: matchedObjective?.masteryCriteria ?? [
        `Complete scheduled activities for ${s.name}`,
      ],
      targetLevel: s.targetLevel,
      status: 'active',
    };
  });

  const createdObjectives = await createObjectives(learner.id, objectivesToInsert);
  const skillIdToObjectiveId = new Map(createdObjectives.map((o) => [o.skill_id, o.id]));

  // b) Journey
  const journeySummary = agentOutput.weeklySummaries.length > 0
    ? agentOutput.weeklySummaries.map((ws) => `Week ${ws.week}: ${ws.headline}`).join('. ')
    : 'Initial learning plan';

  const createdJourney = await createJourney({
    learnerId: learner.id,
    version: 1,
    isCurrent: true,
    reason: 'initial',
    summary: journeySummary,
    changes: {
      weeklySummaries: agentOutput.weeklySummaries,
      isFallback,
      studyOrder: skeleton.studyOrder,
      backlog: skeleton.backlog,
    },
  });

  // c) Activities
  const slotToAgentActivity = new Map(agentOutput.activities.map((a) => [a.slotId, a]));

  const activitiesToInsert: CreateActivityInput[] = skeleton.weeks.flatMap((w) =>
    w.slots.map((slot) => {
      const objId = skillIdToObjectiveId.get(slot.skillId)!;
      const agentActivity = slotToAgentActivity.get(slot.slotId);

      let title = agentActivity?.title;
      if (!title) {
        if (slot.type === 'resource') {
          title = `Learn ${slot.skillSlug}: ${slot.resource?.title ?? 'Key concepts'}`;
        } else if (slot.type === 'practice') {
          title = `Practice: ${slot.skillSlug}`;
        } else {
          title = `Project: ${slot.skillSlug}`;
        }
      }

      return {
        journeyId: createdJourney.id,
        objectiveId: objId,
        skillId: slot.skillId,
        week: slot.week,
        type: slot.type,
        title: title.slice(0, 80),
        mission:
          agentActivity?.mission ??
          `Complete the ${slot.type} activity to strengthen ${slot.skillSlug}.`,
        instructions:
          agentActivity?.instructions ??
          `Spend ${slot.minutes} minutes on the activity.`,
        successCriteria:
          agentActivity?.successCriteria ??
          `Complete the session and record key learnings.`,
        // CRITICAL INVARIANT: Resource ID comes ONLY from deterministic slot, NEVER from agent
        resourceId: slot.resource?.id ?? null,
        estimatedMinutes: slot.minutes,
        status: 'pending',
      };
    })
  );

  await createActivities(activitiesToInsert);

  // Return the newly created active journey data
  return getActiveJourneyData(learner.id);
}

/**
 * Retrieves the active learning journey for the active learner.
 * Makes ZERO AI calls.
 */
export async function getActiveJourneyData(learnerId?: string): Promise<JourneyResponse> {
  const learner = learnerId ? await getLearnerById(learnerId) : await getActiveLearner();
  if (!learner) {
    throw new JourneyServiceError(
      'No active learner profile found. Complete onboarding first.',
      'NO_LEARNER',
      404
    );
  }

  const activeJourney = await getActiveJourney(learner.id);
  if (!activeJourney) {
    throw new JourneyServiceError('No active learning journey found', 'NO_ACTIVE_JOURNEY', 404);
  }

  const objectives = await getObjectivesByLearner(learner.id);
  const activities = await getActivitiesWithDetailsByJourney(activeJourney.id);
  const learnerSkills = await getLearnerSkills(learner.id);

  const learnerSkillMap = new Map(learnerSkills.map((ls) => [ls.skill_id, ls]));

  // Group activities by week
  const weekMap = new Map<number, ActivityWithDetails[]>();
  for (const act of activities) {
    const list = weekMap.get(act.week) ?? [];
    list.push(act);
    weekMap.set(act.week, list);
  }

  const changesObj = (activeJourney.changes ?? {}) as {
    weeklySummaries?: Array<{ week: number; headline: string; note: string }>;
  };
  const summaryList = changesObj.weeklySummaries ?? [];
  const summaryByWeek = new Map(summaryList.map((s) => [s.week, s]));

  const sortedWeeks = Array.from(weekMap.keys()).sort((a, b) => a - b);

  let totalMinutes = 0;
  let completedMinutes = 0;
  let completedCount = 0;
  let skippedCount = 0;

  const weekViews: JourneyWeekView[] = sortedWeeks.map((weekNum) => {
    const acts = weekMap.get(weekNum) ?? [];
    const summary = summaryByWeek.get(weekNum);

    const weekActs: JourneyActivityView[] = acts.map((act) => {
      const ls = learnerSkillMap.get(act.skill_id);
      const progress = ls?.progress ?? 0;
      const readyForAssessment = progress >= 100;

      totalMinutes += act.estimated_minutes;
      if (act.status === 'done') {
        completedCount++;
        completedMinutes += act.estimated_minutes;
      } else if (act.status === 'skipped') {
        skippedCount++;
      }

      return {
        id: act.id,
        objectiveId: act.objective_id,
        skillId: act.skill_id,
        skillSlug: act.skill?.slug ?? '',
        skillName: act.skill?.name ?? act.skill?.slug ?? '',
        week: act.week,
        type: act.type,
        title: act.title,
        mission: act.mission,
        instructions: act.instructions,
        successCriteria: act.success_criteria,
        minutes: act.estimated_minutes,
        status: act.status,
        completedAt: act.completed_at,
        resource: act.resource
          ? {
              id: act.resource.id,
              title: act.resource.title,
              url: act.resource.url,
              type: act.resource.type,
              language: act.resource.language,
              verified: act.resource.verified,
            }
          : null,
        skill: {
          id: act.skill_id,
          slug: act.skill?.slug ?? '',
          name: act.skill?.name ?? '',
          progress,
          status: ls?.status ?? 'available',
          readyForAssessment,
        },
      };
    });

    const weekTotalMinutes = weekActs.reduce((sum, a) => sum + a.minutes, 0);

    return {
      number: weekNum,
      headline: summary?.headline ?? `Week ${weekNum}`,
      note: summary?.note ?? `Total dedication: ${weekTotalMinutes} minutes.`,
      totalMinutes: weekTotalMinutes,
      activities: weekActs,
    };
  });

  // Build skill details map from journey activities
  const skillInfoMap = new Map<string, { slug: string; name: string }>();
  for (const act of activities) {
    if (act.skill_id && act.skill) {
      skillInfoMap.set(act.skill_id, { slug: act.skill.slug, name: act.skill.name });
    }
  }

  // Active journey activities reference the exact objectives created for this journey
  const activeObjectiveIds = new Set(
    activities.map((a) => a.objective_id).filter((id): id is string => Boolean(id))
  );

  // Scope to objectives belonging to the active journey, with fallback to active objectives
  let scopedObjectives = objectives.filter((o) => activeObjectiveIds.has(o.id));
  if (scopedObjectives.length === 0 && objectives.length > 0) {
    scopedObjectives = objectives.filter((o) => o.status === 'active');
  }

  // If some skills are not yet in skillInfoMap, try resolving via role skills
  const missingSkillIds = scopedObjectives.filter(
    (o) => !skillInfoMap.has(o.skill_id) && !o.skill?.name
  );
  if (missingSkillIds.length > 0 && learner.target_role_id) {
    try {
      const roleSkills = await getSkillsByRole(learner.target_role_id);
      for (const rs of roleSkills) {
        if (!skillInfoMap.has(rs.id)) {
          skillInfoMap.set(rs.id, { slug: rs.slug, name: rs.name });
        }
      }
    } catch {
      // Non-fatal fallback if role skills lookup is mocked or fails
    }
  }

  // Enforce SPEC-003 contract: exactly one objective per scheduled skill
  const seenSkillIds = new Set<string>();
  const deduplicatedObjectives: typeof objectives = [];
  for (const obj of scopedObjectives) {
    if (!seenSkillIds.has(obj.skill_id)) {
      seenSkillIds.add(obj.skill_id);
      deduplicatedObjectives.push(obj);
    }
  }

  const objectiveViews: JourneyObjectiveView[] = deduplicatedObjectives.map((obj) => {
    const skillInfo = skillInfoMap.get(obj.skill_id);
    const slug = skillInfo?.slug ?? obj.skill?.slug;
    const name = skillInfo?.name ?? obj.skill?.name ?? slug;

    return {
      id: obj.id,
      skillId: obj.skill_id,
      skillSlug: slug,
      skillName: name,
      description: obj.description,
      criteria: obj.mastery_criteria,
      targetLevel: obj.target_level,
      status: obj.status,
    };
  });


  return {
    journey: {
      id: activeJourney.id,
      version: activeJourney.version,
      isCurrent: activeJourney.is_current,
      reason: activeJourney.reason,
      summary: activeJourney.summary,
      changes: activeJourney.changes,
      createdAt: activeJourney.created_at,
    },
    weeks: weekViews,
    objectives: objectiveViews,
    stats: {
      totalActivities: activities.length,
      completedActivities: completedCount,
      skippedActivities: skippedCount,
      totalMinutes,
      completedMinutes,
    },
  };
}

/**
 * Completes an activity, calculates skill progress using applyActivityCompletion,
 * updates learner_skills in the database, and returns updated activity and skill state.
 * Makes ZERO AI calls.
 * CRITICAL: The skill level does NOT change.
 */
export async function completeActivity(
  activityId: string,
  learnerId?: string
): Promise<CompleteActivityResponse> {
  const learner = learnerId ? await getLearnerById(learnerId) : await getActiveLearner();
  if (!learner) {
    throw new JourneyServiceError('No active learner profile found', 'NO_LEARNER', 404);
  }

  const activity = await getActivityById(activityId);
  if (!activity) {
    throw new JourneyServiceError(`Activity "${activityId}" not found`, 'ACTIVITY_NOT_FOUND', 404);
  }

  const activeJourney = await getActiveJourney(learner.id);
  if (!activeJourney || activity.journey_id !== activeJourney.id) {
    throw new JourneyServiceError(
      'Activity does not belong to active learner journey',
      'NOT_OWNER',
      403
    );
  }

  // Update activity status to done
  const updatedActivity = await updateActivityStatus(activityId, 'done');

  // Load learner skills and role skills to compute current gap
  const learnerSkills = await getLearnerSkills(learner.id);
  const currentLearnerSkill = learnerSkills.find((ls) => ls.skill_id === activity.skill_id);

  let currentGap = 1; // default fallback gap if role skill lookup fails
  if (learner.target_role_id) {
    const roleSkills = await getSkillsByRole(learner.target_role_id);
    const roleSkill = roleSkills.find((rs) => rs.id === activity.skill_id);
    if (roleSkill && currentLearnerSkill) {
      currentGap = Math.max(0, roleSkill.required_level - currentLearnerSkill.level);
    }
  }

  const initialSkillState = currentLearnerSkill ?? {
    skill_id: activity.skill_id,
    level: 0,
    status: 'available' as const,
    progress: 0,
  };

  const updatedProgress = applyActivityCompletion(
    {
      skillId: initialSkillState.skill_id,
      level: initialSkillState.level,
      status: initialSkillState.status,
      progress: initialSkillState.progress,
    },
    { minutes: activity.estimated_minutes },
    currentGap
  );

  // Persist skill progress in learner_skills
  await updateLearnerSkillProgress(
    learner.id,
    activity.skill_id,
    updatedProgress.progress,
    updatedProgress.status
  );

  return {
    success: true,
    activity: {
      id: updatedActivity.id,
      status: 'done',
      completedAt: updatedActivity.completed_at,
    },
    skill: updatedProgress,
  };
}

/**
 * Marks an activity as skipped and returns the accumulated skipped count for the journey.
 * Makes ZERO AI calls.
 * CRITICAL: Does NOT trigger replanning.
 */
export async function skipActivity(
  activityId: string,
  learnerId?: string
): Promise<SkipActivityResponse> {
  const learner = learnerId ? await getLearnerById(learnerId) : await getActiveLearner();
  if (!learner) {
    throw new JourneyServiceError('No active learner profile found', 'NO_LEARNER', 404);
  }

  const activity = await getActivityById(activityId);
  if (!activity) {
    throw new JourneyServiceError(`Activity "${activityId}" not found`, 'ACTIVITY_NOT_FOUND', 404);
  }

  const activeJourney = await getActiveJourney(learner.id);
  if (!activeJourney || activity.journey_id !== activeJourney.id) {
    throw new JourneyServiceError(
      'Activity does not belong to active learner journey',
      'NOT_OWNER',
      403
    );
  }

  // Update activity status to skipped
  const updatedActivity = await updateActivityStatus(activityId, 'skipped');

  // Count total skipped activities in this journey
  const skippedCount = await getSkippedActivitiesCount(activity.journey_id);

  return {
    success: true,
    activity: {
      id: updatedActivity.id,
      status: 'skipped',
    },
    skippedCount,
  };
}
