// services/replan.ts
// Service for deterministic journey replanning, planner agent explanation, and version management (SPEC-004 §3.4)

import { getActiveLearner } from '@/lib/db/repositories/learners';
import { getSkillsByRole } from '@/lib/db/repositories/skills';
import { getLearnerSkills } from '@/lib/db/repositories/learner-skills';
import { getPrerequisitesForSkills } from '@/lib/db/repositories/prerequisites';
import { getTutorStyle } from '@/lib/db/repositories/tutor-styles';
import { getResourcesForSkills } from '@/lib/db/repositories/resources';
import {
  getActiveJourney,
  getAllJourneysForLearner,
  deactivateCurrentJourneys,
  createJourney,
  JourneyRecord,
} from '@/lib/db/repositories/journeys';
import {
  createObjectives,
  updateObjectivesStatusByLearnerAndSkill,
  CreateObjectiveInput,
} from '@/lib/db/repositories/objectives';
import {
  createActivities,
  getActivitiesWithDetailsByJourney,
  CreateActivityInput,
} from '@/lib/db/repositories/activities';
import { computeGapAnalysis } from '@/domain/gaps';
import {
  buildJourneySkeleton,
  computeJourneyChanges,
  shouldReplanForSkippedActivities,
  JourneySkeleton,
  JourneyChange,
  ScheduledSkillSummary,
} from '@/domain/journey';
import { runPlannerAgent } from '@/agents/planner/run';
import { PlannerAgentInput, PlannerAgentOutput } from '@/agents/planner/schema';
import {
  validatePlannerAgentOutput,
  buildDeterministicMinimumFallback,
} from './journey';
import { JourneyReason, ActivityType } from '@/domain/constants';

export class ReplanServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NO_LEARNER'
      | 'NO_TARGET_ROLE'
      | 'NO_ACTIVE_JOURNEY'
      | 'INVALID_REASON'
      | 'REPLAN_NOT_NEEDED'
      | 'INTERNAL_ERROR',
    public readonly status: number
  ) {
    super(message);
    this.name = 'ReplanServiceError';
  }
}

export interface ReplanResult {
  journey: JourneyRecord;
  changes: JourneyChange[];
  changeExplanation: string;
}

/**
 * Executes an end-to-end journey replan triggered by assessment results or skipped activities.
 * SPEC-004 §3.4:
 * 1. Validates reason ('assessment' | 'skipped_activities').
 * 2. Loads active learner, skills, gaps, current journey, and previous activities.
 * 3. Builds new skeleton via deterministic buildJourneySkeleton (struggling receives STRUGGLE_BOOST & reinforcement).
 * 4. Computes deterministic changes list.
 * 5. Calls Planner Agent once with changeContext.
 * 6. Falls back to deterministic minimum if Planner Agent fails.
 * 7. Deactivates previous journey, archives objectives, creates version + 1 journey.
 * 8. Preserves completed activity history intact.
 */
export async function executeReplan(reason: JourneyReason): Promise<ReplanResult> {
  // 1. Validate reason
  if (reason !== 'assessment' && reason !== 'skipped_activities') {
    throw new ReplanServiceError(
      `Invalid replan reason: "${reason}". Only "assessment" and "skipped_activities" are supported for replanning.`,
      'INVALID_REASON',
      409
    );
  }

  // 2. Load learner and active journey
  const learner = await getActiveLearner();
  if (!learner) {
    throw new ReplanServiceError('No active learner profile found.', 'NO_LEARNER', 404);
  }
  if (!learner.target_role_id) {
    throw new ReplanServiceError('Active learner has no target role assigned.', 'NO_TARGET_ROLE', 400);
  }

  const currentJourney = await getActiveJourney(learner.id);
  if (!currentJourney) {
    throw new ReplanServiceError(
      'No active journey found to replan. Generate an initial journey first.',
      'NO_ACTIVE_JOURNEY',
      404
    );
  }

  // 3. Load activities and historical journeys
  const oldActivities = await getActivitiesWithDetailsByJourney(currentJourney.id);

  if (reason === 'skipped_activities') {
    const skippedCount = oldActivities.filter((a) => a.status === 'skipped').length;
    if (!shouldReplanForSkippedActivities(skippedCount)) {
      throw new ReplanServiceError(
        `Skipped activities count (${skippedCount}) has not reached replanning threshold.`,
        'REPLAN_NOT_NEEDED',
        409
      );
    }
  }

  // Reconstruct old skeleton view for comparison
  const oldSkillsMap = new Map<string, ScheduledSkillSummary>();
  for (const act of oldActivities) {
    const skillSlug = act.skill?.slug || '';
    if (!skillSlug) continue;

    let summary = oldSkillsMap.get(skillSlug);
    if (!summary) {
      summary = {
        skillId: act.skill_id,
        skillSlug,
        name: act.skill?.name || skillSlug,
        currentLevel: 0,
        targetLevel: 0,
        reinforcement: false,
        totalScheduledMinutes: 0,
        slots: [],
      };
      oldSkillsMap.set(skillSlug, summary);
    }
    summary.totalScheduledMinutes += act.estimated_minutes;
    summary.slots.push({
      slotId: act.id,
      skillId: act.skill_id,
      skillSlug,
      week: act.week,
      type: act.type as ActivityType,
      minutes: act.estimated_minutes,
      resource: act.resource
        ? {
            id: act.resource.id,
            title: act.resource.title,
            url: act.resource.url,
            type: act.resource.type,
          }
        : undefined,
    });
  }

  const oldSkeleton: JourneySkeleton = {
    weeks: [],
    scheduledSkills: Array.from(oldSkillsMap.values()),
    backlog: [],
    studyOrder: Array.from(oldSkillsMap.keys()),
  };

  // 4. Load learner skills, role requirements, resources, and prerequisites
  const roleSkills = await getSkillsByRole(learner.target_role_id);
  const skillIds = roleSkills.map((rs) => rs.id);
  const learnerSkills = await getLearnerSkills(learner.id);
  const prerequisites = await getPrerequisitesForSkills(skillIds);
  const tutorStyle = await getTutorStyle(learner.id);
  const resources = await getResourcesForSkills(skillIds);
  const allJourneys = await getAllJourneysForLearner(learner.id);

  // 5. Recalculate gaps with updated skill levels and statuses
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

  // 6. Build new deterministic skeleton using SPEC-003 buildJourneySkeleton
  // Struggling skills receive STRUGGLE_BOOST and reinforcement=true
  // Acquired skills leave future plan, newly unlocked enter, completed activities not repeated
  const newSkeleton = buildJourneySkeleton({
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
    previousJourneys: allJourneys.map((j) => ({
      id: j.id,
      activities: oldActivities
        .filter((a) => a.status === 'done')
        .map((a) => ({
          skillId: a.skill_id,
          skillSlug: a.skill?.slug,
          type: a.type,
          resourceId: a.resource_id ?? undefined,
        })),
    })),
    config: {
      learnerLanguage: tutorStyle?.language ?? 'es',
    },
  });

  // 7. Compute deterministic changes
  const changes = computeJourneyChanges(oldSkeleton, newSkeleton);

  // 8. Invoke Planner Agent with changeContext (max 1 LLM call)
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
    skills: newSkeleton.scheduledSkills.map((s) => ({
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
    changeContext: {
      reason,
      changes,
    },
  };

  let agentOutput: PlannerAgentOutput;
  let changeExplanation: string;

  if (newSkeleton.scheduledSkills.length > 0) {
    try {
      const result = await runPlannerAgent(plannerInput);
      if (validatePlannerAgentOutput(result, newSkeleton)) {
        agentOutput = result;
        changeExplanation =
          result.changeExplanation ||
          'Tu plan de aprendizaje ha sido actualizado para reflejar tu desempeño reciente.';
      } else {
        agentOutput = buildDeterministicMinimumFallback(newSkeleton);
        changeExplanation = 'Explicación del plan no disponible en este momento.';
      }
    } catch {
      agentOutput = buildDeterministicMinimumFallback(newSkeleton);
      changeExplanation = 'Explicación del plan no disponible en este momento.';
    }
  } else {
    agentOutput = {
      objectives: [],
      activities: [],
      weeklySummaries: [],
    };
    changeExplanation = 'Has completado todos los requisitos de habilidades para tu rol objetivo.';
  }

  // 9. Update objective statuses:
  // - Acquired skills -> done
  // - Rescheduled skills -> dropped (replaced by new objectives)
  for (const ls of learnerSkills) {
    if (ls.status === 'acquired') {
      await updateObjectivesStatusByLearnerAndSkill(learner.id, ls.skill_id, 'done');
    }
  }

  for (const s of newSkeleton.scheduledSkills) {
    await updateObjectivesStatusByLearnerAndSkill(learner.id, s.skillId, 'dropped');
  }

  // Insert new objectives for the new journey
  const objectivesToInsert: CreateObjectiveInput[] = newSkeleton.scheduledSkills.map((s) => {
    const matched = agentOutput.objectives.find((obj) => obj.skillSlug === s.skillSlug);
    return {
      skillId: s.skillId,
      description:
        matched?.description ??
        `Master the ${s.name} skill to reach target level ${s.targetLevel}.`,
      masteryCriteria: matched?.masteryCriteria ?? [
        `Complete scheduled activities for ${s.name}`,
      ],
      targetLevel: s.targetLevel,
      status: 'active',
    };
  });

  const createdObjectives = await createObjectives(learner.id, objectivesToInsert);
  const skillIdToObjectiveId = new Map(createdObjectives.map((o) => [o.skill_id, o.id]));

  // 10. Persist new Journey version (version + 1, is_current = true)
  // Deactivate current journey
  await deactivateCurrentJourneys(learner.id);

  const newVersion = (currentJourney.version ?? 1) + 1;
  const journeySummary =
    agentOutput.weeklySummaries.length > 0
      ? agentOutput.weeklySummaries.map((ws) => `Week ${ws.week}: ${ws.headline}`).join('. ')
      : `Replanned journey v${newVersion}`;

  const newJourney = await createJourney({
    learnerId: learner.id,
    version: newVersion,
    isCurrent: true,
    reason,
    summary: journeySummary,
    changes: {
      items: changes,
      explanation: changeExplanation,
    },
  });

  // 11. Insert activities for the new Journey
  const activitiesToInsert: CreateActivityInput[] = [];
  for (const week of newSkeleton.weeks) {
    for (const slot of week.slots) {
      const matchedAct = agentOutput.activities.find((a) => a.slotId === slot.slotId);
      const objectiveId = skillIdToObjectiveId.get(slot.skillId);

      activitiesToInsert.push({
        journeyId: newJourney.id,
        objectiveId: objectiveId || createdObjectives[0]?.id || '',
        skillId: slot.skillId,
        week: slot.week,
        type: slot.type,
        estimatedMinutes: slot.minutes,
        title: (matchedAct?.title ?? `Activity for ${slot.skillSlug}`).slice(0, 80),
        mission: matchedAct?.mission ?? `Work on ${slot.skillSlug}`,
        instructions: matchedAct?.instructions ?? '',
        successCriteria: matchedAct?.successCriteria ?? 'Complete session.',
        resourceId: slot.resource?.id ?? null,
        status: 'pending',
      });
    }
  }

  if (activitiesToInsert.length > 0) {
    await createActivities(activitiesToInsert);
  }

  return {
    journey: newJourney,
    changes,
    changeExplanation,
  };
}
