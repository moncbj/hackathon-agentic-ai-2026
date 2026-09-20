import { PASS_THRESHOLD, PARTIAL_THRESHOLD, PREREQ_MIN_LEVEL, STRUGGLE_THRESHOLD, SkillStatus, Verification } from './constants';

export interface AssessmentQuestion { id: string; type: 'multiple_choice' | 'short_answer'; correctOptionId?: string }
export interface AssessmentState { skillId: string; level: number; verification: Verification; status: SkillStatus; progress: number; consecutiveFailures: number }

export function scoreAssessment(input: { questions: AssessmentQuestion[]; mcqAnswers: Record<string, string>; agentGrades: Record<string, number> }): number {
  if (input.questions.length !== 5) throw new Error('An assessment must contain exactly five questions');
  const total = input.questions.reduce((sum, q) => sum + (q.type === 'multiple_choice'
    ? (input.mcqAnswers[q.id] === q.correctOptionId ? 1 : 0)
    : (input.agentGrades[q.id] ?? 0)), 0);
  return total / input.questions.length;
}

export function measureLevel(score: number, targetLevel: number): number {
  return Math.max(0, score >= PASS_THRESHOLD ? targetLevel : score >= PARTIAL_THRESHOLD ? targetLevel - 1 : targetLevel - 2);
}

export function applyAssessmentResult(state: AssessmentState, result: { kind: 'verification' | 'progress'; targetLevel: number; score: number }, requiredLevel: number, prerequisiteStates: AssessmentState[] = []): AssessmentState {
  const passed = result.score >= PASS_THRESHOLD;
  const measured = measureLevel(result.score, result.targetLevel);
  const level = result.kind === 'verification' ? measured : Math.max(state.level, measured);
  const consecutiveFailures = passed ? 0 : state.consecutiveFailures + 1;
  const status: SkillStatus = consecutiveFailures >= STRUGGLE_THRESHOLD ? 'struggling'
    : level >= requiredLevel ? 'acquired'
    : prerequisiteStates.some(s => s.level < PREREQ_MIN_LEVEL) ? 'locked' : 'available';
  return { ...state, level, verification: 'verified', progress: 0, consecutiveFailures, status };
}

export function recomputeStatuses(states: AssessmentState[], requiredLevels: Record<string, number>, prerequisites: Array<{ skillId: string; prerequisiteSkillId: string }>): AssessmentState[] {
  const byId = new Map(states.map(s => [s.skillId, s]));
  return states.map(s => {
    if (s.status === 'acquired' || s.status === 'struggling' || s.status === 'in_progress') return s;
    const blocked = prerequisites.filter(p => p.skillId === s.skillId).some(p => (byId.get(p.prerequisiteSkillId)?.level ?? 0) < PREREQ_MIN_LEVEL);
    return { ...s, status: s.level >= (requiredLevels[s.skillId] ?? Infinity) ? 'acquired' : blocked ? 'locked' : 'available' };
  });
}

export function needsReplan(before: AssessmentState[], after: AssessmentState[]): boolean {
  const old = new Map(before.map(s => [s.skillId, s]));
  return after.some(s => { const prev = old.get(s.skillId); return !prev || prev.level !== s.level || prev.status !== s.status || s.status === 'struggling'; });
}
