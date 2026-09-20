import { describe, expect, it } from 'vitest';
import { applyAssessmentResult, measureLevel, needsReplan, recomputeStatuses, scoreAssessment } from '@/domain/assessment';

const base = { skillId: 'sql', level: 3, verification: 'self_reported' as const, status: 'acquired' as const, progress: 0, consecutiveFailures: 0 };
describe('SPEC-004 assessment domain', () => {
  it('calculates the prescribed 0.6 score and measured levels', () => {
    expect(scoreAssessment({ questions: [{id:'1',type:'multiple_choice',correctOptionId:'a'},{id:'2',type:'multiple_choice',correctOptionId:'a'},{id:'3',type:'multiple_choice',correctOptionId:'a'},{id:'4',type:'short_answer'},{id:'5',type:'short_answer'}], mcqAnswers:{'1':'a','2':'x','3':'a'}, agentGrades:{'4':.5,'5':.5} })).toBe(.6);
    expect(measureLevel(.8, 3)).toBe(3); expect(measureLevel(.5, 3)).toBe(2); expect(measureLevel(.3, 3)).toBe(1);
  });
  it('applies verification/progress rules and struggle threshold', () => {
    expect(applyAssessmentResult(base, {kind:'verification',targetLevel:3,score:.5}, 3).level).toBe(2);
    const failed = applyAssessmentResult({...base, level:1, status:'available', consecutiveFailures:1}, {kind:'progress',targetLevel:3,score:.3}, 3);
    expect(failed.status).toBe('struggling'); expect(failed.level).toBe(1);
  });
  it('unlocks dependents and avoids replan for a passed verification without changes', () => {
    const states = recomputeStatuses([{...base, skillId:'a',level:1,status:'available'}, {...base, skillId:'b',level:0,status:'locked'}], {a:2,b:2}, [{skillId:'b',prerequisiteSkillId:'a'}]);
    expect(states[1].status).toBe('available'); expect(needsReplan([base], [{...base, verification:'verified'}])).toBe(false);
  });
});
