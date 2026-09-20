// domain/assessment.ts
// Deterministic assessment scoring, level measurement, and eligibility rules (SPEC-004 §3.3)

import {
  PASS_THRESHOLD,
  PARTIAL_THRESHOLD,
  STRUGGLE_THRESHOLD,
  PREREQ_MIN_LEVEL,
  AssessmentKind,
  SkillStatus,
  Verification,
} from './constants';

export const LEVEL_DESCRIPTIONS: Record<number, string> = {
  0: 'Novice - Little to no prior knowledge or practical experience',
  1: 'Beginner - Understands core definitions, basic syntax, and fundamental concepts',
  2: 'Intermediate - Can apply skills independently to solve routine, real-world problems',
  3: 'Advanced - Proficient in complex scenarios, optimizations, and industry best practices',
  4: 'Expert - Deep technical mastery, architectural insight, and ability to lead and mentor',
};

export function getLevelDescription(level: number): string {
  return LEVEL_DESCRIPTIONS[level] ?? `Level ${level} competency`;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface QuestionRubricCriterion {
  description: string;
  points: number;
}

export interface QuestionRubric {
  criteria: QuestionRubricCriterion[];
  maxPoints: number;
}

export interface AssessmentQuestion {
  id: string;
  type: 'multiple_choice' | 'short_answer';
  prompt: string;
  options?: QuestionOption[];
  correctOptionId?: string;
  rubric?: QuestionRubric;
  explanation?: string;
}

export interface ShortAnswerGradeItem {
  questionId: string;
  score: number; // 0 to 1
  feedback?: string;
}

export interface ScoreAssessmentParams {
  questions: AssessmentQuestion[];
  mcqAnswers: Record<string, string>; // questionId -> optionId
  agentGrades: ShortAnswerGradeItem[]; // questionId -> score & feedback
}

/**
 * Deterministically computes the final assessment score.
 * Rules:
 * - MCQ: 1 if answer matches correctOptionId, else 0.
 * - Short Answer: uses agent-provided score (clamped between 0 and 1).
 * - Final score: simple average of all questions (exactly 5 questions).
 */
export function scoreAssessment(params: {
  questions: AssessmentQuestion[];
  mcqAnswers: Record<string, string>;
  agentGrades: ShortAnswerGradeItem[];
}): number {
  const { questions, mcqAnswers, agentGrades } = params;

  if (questions.length === 0) {
    return 0;
  }

  const gradeMap = new Map<string, number>();
  for (const grade of agentGrades) {
    gradeMap.set(grade.questionId, Math.max(0, Math.min(1, grade.score)));
  }

  let totalPoints = 0;

  for (const q of questions) {
    if (q.type === 'multiple_choice') {
      const selected = mcqAnswers[q.id];
      const isCorrect = selected !== undefined && q.correctOptionId !== undefined && selected === q.correctOptionId;
      totalPoints += isCorrect ? 1 : 0;
    } else if (q.type === 'short_answer') {
      const score = gradeMap.get(q.id) ?? 0;
      totalPoints += score;
    }
  }

  const rawScore = totalPoints / questions.length;
  // Round to 4 decimal places to prevent floating point inaccuracies like 0.6000000000000001
  return Math.round(rawScore * 10000) / 10000;
}

/**
 * Deterministically measures the demonstrated level based on score and target level.
 * Rules:
 * - score >= PASS_THRESHOLD (0.7) -> targetLevel
 * - score >= PARTIAL_THRESHOLD (0.4) -> targetLevel - 1
 * - otherwise -> targetLevel - 2
 * Minimum level is 0.
 */
export function measureLevel(score: number, targetLevel: number): number {
  if (score >= PASS_THRESHOLD) {
    return Math.max(0, targetLevel);
  }
  if (score >= PARTIAL_THRESHOLD) {
    return Math.max(0, targetLevel - 1);
  }
  return Math.max(0, targetLevel - 2);
}

export interface AssessmentEligibility {
  eligible: boolean;
  kind?: AssessmentKind;
  targetLevel?: number;
  reason?: string;
}

export interface SkillEligibilityInput {
  level: number;
  verification: Verification;
  progress: number;
  status?: SkillStatus;
}

/**
 * Deterministically evaluates whether a learner skill is eligible for an assessment.
 * Rules:
 * - verification: verification === 'self_reported' && level >= 1 -> targetLevel = level
 * - progress: progress >= 100 -> targetLevel = requiredLevel
 * - if both apply: kind = 'progress'
 * - if neither: eligible = false
 */
export function determineEligibility(
  skillState: SkillEligibilityInput,
  requiredLevel: number
): AssessmentEligibility {
  const isVerificationEligible = skillState.verification === 'self_reported' && skillState.level >= 1;
  const isProgressEligible = skillState.progress >= 100;

  if (isProgressEligible) {
    return {
      eligible: true,
      kind: 'progress',
      targetLevel: requiredLevel,
    };
  }

  if (isVerificationEligible) {
    return {
      eligible: true,
      kind: 'verification',
      targetLevel: skillState.level,
    };
  }

  return {
    eligible: false,
    reason: 'Skill is not eligible for assessment. Requires self-reported level >= 1 or progress >= 100%.',
  };
}

export interface LearnerSkillStateInput {
  skillId: string;
  level: number;
  verification: Verification;
  status: SkillStatus;
  progress: number;
  consecutiveFailures?: number;
}

export interface AssessmentResultInput {
  kind: AssessmentKind;
  targetLevel: number;
  score: number;
}

export interface PrerequisiteStateInput {
  skillId: string;
  level: number;
}

export interface UpdatedAssessmentSkillState {
  skillId: string;
  level: number;
  verification: Verification;
  passed: boolean;
  measuredLevel: number;
  consecutiveFailures: number;
  status: SkillStatus;
  progress: number;
}

/**
 * Deterministically applies an assessment result to a learner skill state.
 * Rules (SPEC-004 §3.3):
 * 1. measured = measureLevel(score, targetLevel)
 * 2. New level:
 *    - verification: new level = measured (can drop)
 *    - progress: new level = max(current level, measured) (never drops)
 * 3. verification = 'verified'
 * 4. passed = score >= PASS_THRESHOLD (0.7)
 * 5. progress = 0
 * 6. consecutiveFailures: 0 if passed, else previous + 1
 * 7. Status evaluation:
 *    - 'struggling' if consecutiveFailures >= STRUGGLE_THRESHOLD (2)
 *    - otherwise 'acquired' if newLevel >= requiredLevel
 *    - otherwise 'locked' if any prerequisite has level < PREREQ_MIN_LEVEL (1)
 *    - otherwise 'available'
 */
export function applyAssessmentResult(
  skillState: LearnerSkillStateInput,
  assessmentResult: AssessmentResultInput,
  requiredLevel: number,
  prerequisites: PrerequisiteStateInput[] = [],
  config?: {
    passThreshold?: number;
    partialThreshold?: number;
    struggleThreshold?: number;
    prereqMinLevel?: number;
  }
): UpdatedAssessmentSkillState {
  const passThreshold = config?.passThreshold ?? PASS_THRESHOLD;
  const struggleThreshold = config?.struggleThreshold ?? STRUGGLE_THRESHOLD;
  const prereqMinLevel = config?.prereqMinLevel ?? PREREQ_MIN_LEVEL;

  const measured = measureLevel(assessmentResult.score, assessmentResult.targetLevel);

  let newLevel: number;
  if (assessmentResult.kind === 'verification') {
    newLevel = measured;
  } else {
    newLevel = Math.max(skillState.level, measured);
  }

  const passed = assessmentResult.score >= passThreshold;
  const previousFailures = skillState.consecutiveFailures ?? 0;
  const consecutiveFailures = passed ? 0 : previousFailures + 1;

  let status: SkillStatus;
  if (consecutiveFailures >= struggleThreshold) {
    status = 'struggling';
  } else if (newLevel >= requiredLevel) {
    status = 'acquired';
  } else {
    const hasUnmetPrereq = prerequisites.some((p) => p.level < prereqMinLevel);
    if (hasUnmetPrereq) {
      status = 'locked';
    } else {
      status = 'available';
    }
  }

  return {
    skillId: skillState.skillId,
    level: newLevel,
    verification: 'verified',
    passed,
    measuredLevel: measured,
    consecutiveFailures,
    status,
    progress: 0,
  };
}
