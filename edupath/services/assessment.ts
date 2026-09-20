// services/assessment.ts
// Service for assessment eligibility, generation, grading, and state updates (SPEC-004 §3.1-§3.3, §3.5)

import { getActiveLearner, getLearnerById } from '@/lib/db/repositories/learners';
import { getSkillsByRole, getSkillBySlug } from '@/lib/db/repositories/skills';
import {
  getLearnerSkills,
  getLearnerSkill,
} from '@/lib/db/repositories/learner-skills';
import { getPrerequisitesByRole } from '@/lib/db/repositories/prerequisites';
import { getTutorStyle } from '@/lib/db/repositories/tutor-styles';
import {
  createAssessment,
  getAssessmentById,
  getGeneratedAssessmentForSkill,
  getPastPromptsForSkill,
  submitAssessmentTransaction,
  AssessmentRecord,
} from '@/lib/db/repositories/assessments';
import {
  determineEligibility,
  scoreAssessment,
  applyAssessmentResult,
  getLevelDescription,
} from '@/domain/assessment';
import { recomputeStatuses, needsReplan } from '@/domain/skill-state';
import { runAssessmentGenerate, runAssessmentGrade } from '@/agents/assessment/run';
import { stripSecrets, SanitizedQuestion } from '@/agents/assessment/schema';
import { SkillStatus, Verification } from '@/domain/constants';

export class AssessmentServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NO_LEARNER'
      | 'SKILL_NOT_FOUND'
      | 'INELIGIBLE'
      | 'ASSESSMENT_NOT_FOUND'
      | 'ALREADY_GRADED'
      | 'INVALID_ANSWERS'
      | 'GRADING_FAILED'
      | 'INTERNAL_ERROR',
    public readonly status: number
  ) {
    super(message);
    this.name = 'AssessmentServiceError';
  }
}

export interface GeneratedAssessmentResponse {
  assessment: {
    id: string;
    kind: string;
    targetLevel: number;
    skillSlug: string;
    skillName: string;
    status: string;
    createdAt: string;
  };
  questions: SanitizedQuestion[];
}

export interface AssessmentSubmitResponse {
  score: number;
  measuredLevel: number;
  passed: boolean;
  newLevel: number;
  verification: Verification;
  status: SkillStatus;
  itemFeedback: Array<{ questionId: string; score: number; feedback?: string }>;
  overallFeedback: string;
  strugglesWith: string[];
  replanRecommended: boolean;
  stateChanges: {
    skillSlug: string;
    oldLevel: number;
    newLevel: number;
    oldStatus: SkillStatus;
    newStatus: SkillStatus;
    unlockedSkills: string[];
  };
}

/**
 * Generates or reuses a 5-question assessment for a learner skill.
 * Enforces eligibility, avoids prompt repetition, and sanitizes keys.
 * Maximum 1 LLM call (0 if reusing an uncompleted generated assessment).
 */
export async function generateAssessment(
  skillSlug: string
): Promise<GeneratedAssessmentResponse> {
  const learner = await getActiveLearner();
  if (!learner) {
    throw new AssessmentServiceError('No active learner profile found', 'NO_LEARNER', 404);
  }
  if (!learner.target_role_id) {
    throw new AssessmentServiceError('Learner has no target role selected', 'INTERNAL_ERROR', 400);
  }

  const skill = await getSkillBySlug(skillSlug);
  if (!skill) {
    throw new AssessmentServiceError(`Skill "${skillSlug}" not found`, 'SKILL_NOT_FOUND', 404);
  }

  const roleSkills = await getSkillsByRole(learner.target_role_id);
  const roleSkill = roleSkills.find((rs) => rs.id === skill.id);
  if (!roleSkill) {
    throw new AssessmentServiceError(`Skill "${skillSlug}" does not belong to target role`, 'SKILL_NOT_FOUND', 404);
  }

  const skillState = await getLearnerSkill(learner.id, skill.id);
  if (!skillState) {
    throw new AssessmentServiceError(`No learner state found for skill "${skillSlug}"`, 'INELIGIBLE', 404);
  }

  // Determine eligibility deterministically
  const eligibility = determineEligibility(
    {
      level: skillState.level,
      verification: skillState.verification,
      progress: skillState.progress,
      status: skillState.status,
    },
    roleSkill.required_level
  );

  if (!eligibility.eligible || !eligibility.kind || eligibility.targetLevel === undefined) {
    throw new AssessmentServiceError(
      eligibility.reason || 'Skill is not eligible for assessment',
      'INELIGIBLE',
      409
    );
  }

  // Check if an uncompleted 'generated' assessment already exists for this skill
  const existingAssessment = await getGeneratedAssessmentForSkill(learner.id, skill.id);
  if (existingAssessment) {
    return {
      assessment: {
        id: existingAssessment.id,
        kind: existingAssessment.kind,
        targetLevel: existingAssessment.target_level,
        skillSlug: existingAssessment.skill?.slug || skill.slug,
        skillName: existingAssessment.skill?.name || skill.name,
        status: existingAssessment.status,
        createdAt: existingAssessment.created_at,
      },
      questions: stripSecrets(existingAssessment.questions),
    };
  }

  // Retrieve past prompts to prevent repetition
  const previousPrompts = await getPastPromptsForSkill(learner.id, skill.id);
  const levelDescription = getLevelDescription(eligibility.targetLevel);
  const tutorStyle = await getTutorStyle(learner.id);
  const language = tutorStyle?.language || 'es';

  // Run Assessment Agent (Operation 1: Generate)
  const agentOutput = await runAssessmentGenerate({
    skill: {
      slug: skill.slug,
      name: skill.name,
      description: skill.description || '',
    },
    targetLevel: eligibility.targetLevel,
    levelDescription,
    language,
    mix: {
      multipleChoice: 3,
      shortAnswer: 2,
    },
    previousPrompts,
  });

  // Persist assessment
  const createdRecord = await createAssessment({
    learnerId: learner.id,
    skillId: skill.id,
    kind: eligibility.kind,
    targetLevel: eligibility.targetLevel,
    questions: agentOutput.questions,
  });

  return {
    assessment: {
      id: createdRecord.id,
      kind: createdRecord.kind,
      targetLevel: createdRecord.target_level,
      skillSlug: createdRecord.skill?.slug || skill.slug,
      skillName: createdRecord.skill?.name || skill.name,
      status: createdRecord.status,
      createdAt: createdRecord.created_at,
    },
    questions: stripSecrets(createdRecord.questions),
  };
}

/**
 * Retrieves assessment details.
 * If status === 'generated', sensitive answer keys, rubrics, and explanations are stripped.
 * If status === 'graded', full results with explanations and rubrics are returned.
 */
export async function getAssessment(id: string): Promise<{
  assessment: AssessmentRecord;
  sanitized: boolean;
}> {
  const assessment = await getAssessmentById(id);
  if (!assessment) {
    throw new AssessmentServiceError(`Assessment "${id}" not found`, 'ASSESSMENT_NOT_FOUND', 404);
  }

  if (assessment.status === 'generated') {
    return {
      assessment: {
        ...assessment,
        questions: stripSecrets(assessment.questions) as unknown as typeof assessment.questions,
      },
      sanitized: true,
    };
  }

  return {
    assessment,
    sanitized: false,
  };
}

/**
 * Submits answers for a generated assessment, executes deterministic MCQ grading,
 * calls Assessment Agent ONLY for short answers, and persists deterministic state updates.
 *
 * CRITICAL FAILURE INVARIANT:
 * If short-answer grading fails, throws 502 without touching learner state or marking assessment graded.
 */
export async function submitAssessment(
  assessmentId: string,
  answers: Record<string, string>
): Promise<AssessmentSubmitResponse> {
  const assessment = await getAssessmentById(assessmentId);
  if (!assessment) {
    throw new AssessmentServiceError(`Assessment "${assessmentId}" not found`, 'ASSESSMENT_NOT_FOUND', 404);
  }
  if (assessment.status !== 'generated') {
    throw new AssessmentServiceError('Assessment has already been graded', 'ALREADY_GRADED', 400);
  }

  const shortAnswerQuestions = assessment.questions.filter((q) => q.type === 'short_answer');
  const shortAnswerItems = shortAnswerQuestions.map((q) => ({
    questionId: q.id,
    prompt: q.prompt,
    rubric: q.rubric!,
    answer: answers[q.id] || '',
  }));

  // Call Assessment Agent (Operation 2: Grade) ONLY for short answers
  let gradeOutput;
  try {
    const tutorStyle = await getTutorStyle(assessment.learner_id);
    gradeOutput = await runAssessmentGrade({
      skill: {
        slug: assessment.skill?.slug || '',
        name: assessment.skill?.name || '',
        description: assessment.skill?.description,
      },
      targetLevel: assessment.target_level,
      items: shortAnswerItems,
      language: tutorStyle?.language || 'es',
    });
  } catch (err) {
    // Invariant: Do NOT modify learner state if grading fails!
    throw new AssessmentServiceError(
      `Assessment grading failed: ${err instanceof Error ? err.message : String(err)}`,
      'GRADING_FAILED',
      502
    );
  }

  // Deterministic scoring of the complete 5 questions
  const finalScore = scoreAssessment({
    questions: assessment.questions,
    mcqAnswers: answers,
    agentGrades: gradeOutput.items,
  });

  const learner = await getLearnerById(assessment.learner_id);
  if (!learner || !learner.target_role_id) {
    throw new AssessmentServiceError('Learner profile or target role missing', 'INTERNAL_ERROR', 500);
  }

  const allSkills = await getLearnerSkills(learner.id);
  const currentSkillState = allSkills.find((s) => s.skill_id === assessment.skill_id);
  if (!currentSkillState) {
    throw new AssessmentServiceError('Target skill state not found for learner', 'INTERNAL_ERROR', 500);
  }

  const roleSkills = await getSkillsByRole(learner.target_role_id);
  const roleSkill = roleSkills.find((rs) => rs.id === assessment.skill_id);
  const requiredLevel = roleSkill?.required_level ?? 3;

  const allPrereqs = await getPrerequisitesByRole(learner.target_role_id);
  const prereqsForCurrentSkill = allPrereqs
    .filter((p) => p.skillId === assessment.skill_id)
    .map((p) => ({
      skillId: p.prerequisiteSkillId,
      level: allSkills.find((s) => s.skill_id === p.prerequisiteSkillId)?.level ?? 0,
    }));

  // Deterministic state update
  const appliedResult = applyAssessmentResult(
    {
      skillId: currentSkillState.skill_id,
      level: currentSkillState.level,
      verification: currentSkillState.verification,
      status: currentSkillState.status,
      progress: currentSkillState.progress,
      consecutiveFailures: currentSkillState.consecutive_failures,
    },
    {
      kind: assessment.kind,
      targetLevel: assessment.target_level,
      score: finalScore,
    },
    requiredLevel,
    prereqsForCurrentSkill
  );

  // Snapshot before and after states to evaluate unlocking & replan necessity
  const beforeStates = allSkills.map((s) => ({
    skillId: s.skill_id,
    level: s.level,
    status: s.status,
  }));

  const intermediateStates = allSkills.map((s) =>
    s.skill_id === assessment.skill_id
      ? {
          skillId: s.skill_id,
          level: appliedResult.level,
          status: appliedResult.status,
        }
      : {
          skillId: s.skill_id,
          level: s.level,
          status: s.status,
        }
  );

  // Recompute locked vs available for other skills
  const recomputedStates = recomputeStatuses(intermediateStates, allPrereqs);

  const statusChanges: Array<{ skillId: string; status: SkillStatus }> = [];
  const unlockedSkills: string[] = [];

  for (const after of recomputedStates) {
    if (after.skillId === assessment.skill_id) continue;
    const before = allSkills.find((s) => s.skill_id === after.skillId);
    if (before && before.status !== after.status) {
      statusChanges.push({ skillId: after.skillId, status: after.status });
      if (after.status === 'available' && before.status === 'locked') {
        unlockedSkills.push(after.skillId);
      }
    }
  }

  const replanRecommended = needsReplan(beforeStates, recomputedStates);

  await submitAssessmentTransaction({
    assessmentId: assessment.id, learnerId: learner.id, skillId: assessment.skill_id,
    skillState: { level: appliedResult.level, verification: appliedResult.verification, status: appliedResult.status, progress: appliedResult.progress, consecutiveFailures: appliedResult.consecutiveFailures },
    statusUpdates: statusChanges,
    answers,
    score: finalScore,
    measuredLevel: appliedResult.measuredLevel,
    passed: appliedResult.passed,
    feedback: {
      items: gradeOutput.items,
      overallFeedback: gradeOutput.overallFeedback,
      strugglesWith: gradeOutput.strugglesWith,
    },
  });

  return {
    score: finalScore,
    measuredLevel: appliedResult.measuredLevel,
    passed: appliedResult.passed,
    newLevel: appliedResult.level,
    verification: appliedResult.verification,
    status: appliedResult.status,
    itemFeedback: gradeOutput.items,
    overallFeedback: gradeOutput.overallFeedback,
    strugglesWith: gradeOutput.strugglesWith,
    replanRecommended,
    stateChanges: {
      skillSlug: assessment.skill?.slug || '',
      oldLevel: currentSkillState.level,
      newLevel: appliedResult.level,
      oldStatus: currentSkillState.status,
      newStatus: appliedResult.status,
      unlockedSkills,
    },
  };
}
