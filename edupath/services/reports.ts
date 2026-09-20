// services/reports.ts
// Orchestration service for Progress Reports and Tutor Report Agent (SPEC-005 §3.2, §3.4)

import { getActiveLearner } from '@/lib/db/repositories/learners';
import { getRoleById } from '@/lib/db/repositories/roles';
import { getTutorStyle } from '@/lib/db/repositories/tutor-styles';
import { getSkillsByRole } from '@/lib/db/repositories/skills';
import { getLearnerSkills } from '@/lib/db/repositories/learner-skills';
import { getPrerequisitesByRole } from '@/lib/db/repositories/prerequisites';
import { getActiveJourney } from '@/lib/db/repositories/journeys';
import { getActivitiesByJourney } from '@/lib/db/repositories/activities';
import { getAssessmentsByLearner } from '@/lib/db/repositories/assessments';
import { createReport, getLatestReports, ReportRecord, ReportNarrative } from '@/lib/db/repositories/reports';
import { buildProgressReport, ReportSkillInput } from '@/domain/report';
import { runTutorReport } from '@/agents/tutor/run';
import { TutorReportInput } from '@/agents/tutor/schema';

export type { ReportRecord, ReportNarrative };

export class ReportServiceError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code: string = 'REPORT_ERROR'
  ) {
    super(message);
    this.name = 'ReportServiceError';
  }
}

/**
 * Generates a comprehensive progress report:
 * 1. Computes deterministic progress report data (zero AI).
 * 2. Attempts to generate AI narrative and rewritten next steps via Tutor Agent.
 * 3. Falls back gracefully to deterministic default narrative if AI fails or candidate IDs mismatch.
 * 4. Saves and returns the report.
 */
export async function generateProgressReport(): Promise<ReportRecord> {
  // 1. Load active learner
  const learner = await getActiveLearner();
  if (!learner) {
    throw new ReportServiceError('No active learner profile found. Complete onboarding first.', 404, 'NO_LEARNER');
  }

  if (!learner.target_role_id) {
    throw new ReportServiceError('Active learner has no target role specified', 400, 'NO_TARGET_ROLE');
  }

  const role = await getRoleById(learner.target_role_id);
  if (!role) {
    throw new ReportServiceError('Target role not found', 404, 'ROLE_NOT_FOUND');
  }

  // 2. Load tutor style
  const styleRecord = await getTutorStyle(learner.id);
  const tutorStyle = {
    language: styleRecord?.language ?? 'es',
    tone: styleRecord?.tone ?? 'cercano',
    detailLevel: styleRecord?.detail_level ?? 'equilibrado',
    useAnalogies: styleRecord?.use_analogies ?? true,
    freeInstructions: styleRecord?.free_instructions ?? '',
  };

  // 3. Load skills, learner state, and prerequisites
  const roleSkills = await getSkillsByRole(role.id);
  const learnerSkills = await getLearnerSkills(learner.id);
  const learnerSkillMap = new Map(learnerSkills.map((ls) => [ls.skill_id, ls]));
  const prerequisites = await getPrerequisitesByRole(role.id);

  const reportSkills: ReportSkillInput[] = roleSkills.map((rs) => {
    const ls = learnerSkillMap.get(rs.id);
    return {
      skillId: rs.id,
      slug: rs.slug,
      name: rs.name,
      level: ls?.level ?? 0,
      requiredLevel: rs.required_level,
      weight: rs.weight,
      verification: ls?.verification ?? 'self_reported',
      status: ls?.status ?? 'available',
      progress: ls?.progress ?? 0,
      consecutiveFailures: ls?.consecutive_failures ?? 0,
    };
  });

  // 4. Load journey and activities
  const activeJourney = await getActiveJourney(learner.id);
  let completedThisWeek = 0;
  let totalThisWeek = 0;
  let completedOverall = 0;
  let skippedOverall = 0;
  let journeyVersion = 1;
  let latestChangeSummary = 'Initial plan version.';

  if (activeJourney) {
    journeyVersion = activeJourney.version;
    latestChangeSummary = activeJourney.summary || 'Learning journey active.';

    const activities = await getActivitiesByJourney(activeJourney.id);
    if (activities.length > 0) {
      // Find current week
      const pendingActivity = activities.find((a) => a.status === 'pending');
      const currentWeekNumber = pendingActivity ? pendingActivity.week : activities[0].week;

      for (const act of activities) {
        if (act.week === currentWeekNumber) {
          totalThisWeek++;
          if (act.status === 'done') {
            completedThisWeek++;
          }
        }
        if (act.status === 'done') {
          completedOverall++;
        } else if (act.status === 'skipped') {
          skippedOverall++;
        }
      }
    }
  }

  // 5. Load assessments
  const assessments = await getAssessmentsByLearner(learner.id);
  const gradedAssessments = assessments.filter((a) => a.status === 'graded');
  const lastThreeAssessments = gradedAssessments.slice(0, 3).map((a) => ({
    skill: a.skill?.name ?? 'Skill',
    score: a.score ?? 0,
    date: a.graded_at || a.created_at,
  }));

  // 6. Compute deterministic progress report
  const reportData = buildProgressReport({
    skills: reportSkills,
    prerequisites,
    activity: {
      completedThisWeek,
      totalThisWeek,
      completedOverall,
      skippedOverall,
    },
    assessments: {
      totalCount: gradedAssessments.length,
      lastThree: lastThreeAssessments,
    },
    journey: {
      currentVersion: journeyVersion,
      latestChangeSummary,
    },
  });

  // 7. Deterministic fallback narrative
  const defaultNarrative: ReportNarrative = {
    headline: `Progress Report: ${role.name}`,
    narrative: `You have acquired ${reportData.acquired.length} skills, with ${reportData.inProgress.length} currently in progress and ${reportData.remainingGaps.length} remaining gaps. Keep working on your weekly missions to continue advancing toward your goal.`,
    nextSteps: reportData.nextStepCandidates.map((c) => ({
      candidateId: c.candidateId,
      text: c.defaultText,
    })),
  };

  // 8. Attempt AI narrative generation via Tutor Agent
  let finalNarrative: ReportNarrative = defaultNarrative;

  try {
    const reportInput: TutorReportInput = {
      tutorStyle,
      reportData,
    };

    const agentOutput = await runTutorReport(reportInput);

    // Validate candidates: each candidateId MUST exist in reportData.nextStepCandidates
    const validCandidateIds = new Set(reportData.nextStepCandidates.map((c) => c.candidateId));
    const allCandidatesValid = agentOutput.nextSteps.every((s) => validCandidateIds.has(s.candidateId));

    if (allCandidatesValid && agentOutput.nextSteps.length > 0) {
      finalNarrative = {
        headline: agentOutput.headline,
        narrative: agentOutput.narrative,
        nextSteps: agentOutput.nextSteps,
      };
    } else {
      // Reject AI result with unknown candidateId and use deterministic fallback
      console.warn('Tutor report agent returned unrecognized candidateId; using fallback next steps.');
      finalNarrative = defaultNarrative;
    }
  } catch (err: unknown) {
    // If AI fails, do NOT fail the report; use deterministic fallback
    console.warn(`Tutor report agent failed: ${err instanceof Error ? err.message : String(err)}; using fallback.`);
    finalNarrative = defaultNarrative;
  }

  // 9. Persist report
  const savedReport = await createReport({
    learnerId: learner.id,
    data: reportData,
    narrative: finalNarrative,
  });

  return savedReport;
}

/**
 * Retrieves the latest 5 reports for the active learner.
 */
export async function getRecentReports(limit: number = 5): Promise<ReportRecord[]> {
  const learner = await getActiveLearner();
  if (!learner) {
    throw new ReportServiceError('No active learner profile found. Complete onboarding first.', 404, 'NO_LEARNER');
  }

  return getLatestReports(learner.id, limit);
}
