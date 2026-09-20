// domain/report.ts
// Pure, deterministic computation of progress report data and next-step candidates (SPEC-005 §3.2)

import { computeGapAnalysis, GapAnalysisRoleSkill, GapAnalysisLearnerSkill, GapAnalysisPrerequisite } from './gaps';
import { SkillStatus, Verification } from './constants';

export interface ReportSkillInput {
  skillId: string;
  slug: string;
  name: string;
  level: number;
  requiredLevel: number;
  weight: number;
  verification: Verification;
  status: SkillStatus;
  progress: number;
  consecutiveFailures?: number;
}

export interface ReportActivitySummary {
  completedThisWeek: number;
  totalThisWeek: number;
  completedOverall: number;
  skippedOverall: number;
}

export interface ReportAssessmentItem {
  skill: string;
  score: number;
  date: string;
}

export interface ReportAssessmentSummary {
  totalCount: number;
  lastThree: ReportAssessmentItem[];
}

export interface ReportJourneySummary {
  currentVersion: number;
  latestChangeSummary: string;
}

export interface NextStepCandidate {
  candidateId: string;
  title: string;
  actionType: 'start_assessment' | 'open_skill' | 'open_journey' | 'open_notebook';
  skillSlug?: string;
  defaultText: string;
}

export interface AcquiredSkillReport {
  slug: string;
  name: string;
  level: number;
  verification: Verification;
}

export interface InProgressSkillReport {
  slug: string;
  name: string;
  level: number;
  requiredLevel: number;
  progress: number;
}

export interface StrugglingSkillReport {
  slug: string;
  name: string;
  level: number;
  requiredLevel: number;
  consecutiveFailures: number;
}

export interface RemainingGapReport {
  slug: string;
  name: string;
  level: number;
  requiredLevel: number;
  gap: number;
  priority: number;
}

export interface ToVerifySkillReport {
  slug: string;
  name: string;
  level: number;
  weight: number;
}

export interface ProgressReportResult {
  acquired: AcquiredSkillReport[];
  inProgress: InProgressSkillReport[];
  struggling: StrugglingSkillReport[];
  remainingGaps: RemainingGapReport[];
  toVerify: ToVerifySkillReport[];
  activity: ReportActivitySummary;
  assessments: ReportAssessmentSummary;
  journey: ReportJourneySummary;
  nextStepCandidates: NextStepCandidate[];
}

export interface BuildProgressReportParams {
  skills: ReportSkillInput[];
  prerequisites?: GapAnalysisPrerequisite[];
  activity: ReportActivitySummary;
  assessments: ReportAssessmentSummary;
  journey: ReportJourneySummary;
}

/**
 * Deterministically constructs the progress report blocks and ordered next-step candidates.
 * Pure function: zero database access, zero AI calls.
 */
export function buildProgressReport(params: BuildProgressReportParams): ProgressReportResult {
  const { skills, prerequisites = [], activity, assessments, journey } = params;

  // 1. Acquired skills (status = 'acquired')
  const acquired: AcquiredSkillReport[] = skills
    .filter((s) => s.status === 'acquired')
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      level: s.level,
      verification: s.verification,
    }));

  // 2. In progress skills (status = 'in_progress')
  const inProgress: InProgressSkillReport[] = skills
    .filter((s) => s.status === 'in_progress')
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      level: s.level,
      requiredLevel: s.requiredLevel,
      progress: s.progress,
    }));

  // 3. Struggling skills (status = 'struggling')
  const struggling: StrugglingSkillReport[] = skills
    .filter((s) => s.status === 'struggling')
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      level: s.level,
      requiredLevel: s.requiredLevel,
      consecutiveFailures: s.consecutiveFailures ?? 0,
    }));

  // 4. Remaining gaps and toVerify
  // We reuse computeGapAnalysis from domain/gaps to maintain exact deterministic sorting and verification logic
  const roleSkills: GapAnalysisRoleSkill[] = skills.map((s) => ({
    skillId: s.skillId,
    skillSlug: s.slug,
    name: s.name,
    requiredLevel: s.requiredLevel,
    weight: s.weight,
  }));

  const learnerSkills: GapAnalysisLearnerSkill[] = skills.map((s) => ({
    skillId: s.skillId,
    level: s.level,
    verification: s.verification,
  }));

  const gapAnalysis = computeGapAnalysis({
    roleSkills,
    learnerSkills,
    prerequisites,
  });

  // Remaining gaps: skills with gap > 0, keeping deterministic order (priority DESC, depth ASC, name ASC, slug ASC)
  const remainingGaps: RemainingGapReport[] = gapAnalysis
    .filter((g) => g.gap > 0)
    .map((g) => ({
      slug: g.skillSlug,
      name: g.name,
      level: g.level,
      requiredLevel: g.requiredLevel,
      gap: g.gap,
      priority: g.priority,
    }));

  // To verify: skills where needsVerification is true (gap === 0 && verification === 'self_reported' && weight >= 4)
  const toVerify: ToVerifySkillReport[] = gapAnalysis
    .filter((g) => g.needsVerification)
    .map((g) => ({
      slug: g.skillSlug,
      name: g.name,
      level: g.level,
      weight: g.weight,
    }));

  // 5. Next-step candidates (fixed priority order up to max 5):
  // 1) Skills ready to assess (progress >= 100) -> start_assessment
  // 2) Reinforce struggling skills (status = 'struggling') -> open_skill
  // 3) Verify needsVerification skills, starting with the one of highest weight -> start_assessment
  // 4) Continue with week's pending activities -> open_journey
  // 5) If none of the above: review the plan -> open_journey
  const candidates: NextStepCandidate[] = [];
  const MAX_CANDIDATES = 5;

  // Priority 1: Ready to assess (progress >= 100)
  const readyToAssess = skills
    .filter((s) => s.progress >= 100 && s.level < s.requiredLevel)
    // Sort by highest weight, then name
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));

  for (const s of readyToAssess) {
    if (candidates.length >= MAX_CANDIDATES) break;
    candidates.push({
      candidateId: `assess_${s.slug}`,
      title: `Assess ${s.name}`,
      actionType: 'start_assessment',
      skillSlug: s.slug,
      defaultText: `Take the assessment for ${s.name} to demonstrate your progress.`,
    });
  }

  // Priority 2: Struggling skills
  const strugglingCandidates = skills
    .filter((s) => s.status === 'struggling')
    .sort((a, b) => (b.consecutiveFailures ?? 0) - (a.consecutiveFailures ?? 0) || b.weight - a.weight || a.name.localeCompare(b.name));

  for (const s of strugglingCandidates) {
    if (candidates.length >= MAX_CANDIDATES) break;
    candidates.push({
      candidateId: `reinforce_${s.slug}`,
      title: `Reinforce ${s.name}`,
      actionType: 'open_skill',
      skillSlug: s.slug,
      defaultText: `Reinforce ${s.name} with focused practice on challenging areas.`,
    });
  }

  // Priority 3: Needs verification skills, highest weight first
  const verifyCandidates = gapAnalysis
    .filter((g) => g.needsVerification)
    .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));

  for (const g of verifyCandidates) {
    if (candidates.length >= MAX_CANDIDATES) break;
    candidates.push({
      candidateId: `verify_${g.skillSlug}`,
      title: `Verify ${g.name}`,
      actionType: 'start_assessment',
      skillSlug: g.skillSlug,
      defaultText: `Verify ${g.name} (importance weight ${g.weight}) with an objective assessment.`,
    });
  }

  // Priority 4: Pending activities in current week
  const hasPendingThisWeek = activity.totalThisWeek > 0 && activity.completedThisWeek < activity.totalThisWeek;
  if (hasPendingThisWeek && candidates.length < MAX_CANDIDATES) {
    candidates.push({
      candidateId: 'continue_week',
      title: "Continue this week's activities",
      actionType: 'open_journey',
      defaultText: "Continue with the week's pending activities in your learning journey.",
    });
  }

  // Priority 5: Fallback if no candidates exist
  if (candidates.length === 0) {
    candidates.push({
      candidateId: 'review_plan',
      title: 'Review your learning journey',
      actionType: 'open_journey',
      defaultText: 'Review your learning plan and prepare for upcoming goals.',
    });
  }

  return {
    acquired,
    inProgress,
    struggling,
    remainingGaps,
    toVerify,
    activity,
    assessments,
    journey,
    nextStepCandidates: candidates.slice(0, MAX_CANDIDATES),
  };
}
