import { describe, it, expect } from 'vitest';
import { computeInitialSkillStates } from '@/domain/skill-state';

describe('computeInitialSkillStates', () => {
  it('matches the 4 spec examples from SPEC-001 §4.1 (Skills A, B, C, D)', () => {
    // Skill A: required 3, declared 3, no prereq -> acquired
    // Skill B: required 3, declared 0, prereq A (declared 3) -> available
    // Skill C: required 2, declared 0, prereq B (declared 0) -> locked
    // Skill D: required 2, declared 1, no prereq -> available
    const roleSkills = [
      { skillId: 'skill-a', requiredLevel: 3 },
      { skillId: 'skill-b', requiredLevel: 3 },
      { skillId: 'skill-c', requiredLevel: 2 },
      { skillId: 'skill-d', requiredLevel: 2 },
    ];

    const declaredLevels = [
      { skillId: 'skill-a', level: 3 },
      { skillId: 'skill-b', level: 0 },
      { skillId: 'skill-c', level: 0 },
      { skillId: 'skill-d', level: 1 },
    ];

    const prerequisites = [
      { skillId: 'skill-b', prerequisiteSkillId: 'skill-a' },
      { skillId: 'skill-c', prerequisiteSkillId: 'skill-b' },
    ];

    const results = computeInitialSkillStates({
      roleSkills,
      declaredLevels,
      prerequisites,
    });

    const byId = new Map(results.map((r) => [r.skillId, r]));

    const stateA = byId.get('skill-a')!;
    expect(stateA.level).toBe(3);
    expect(stateA.status).toBe('acquired');
    expect(stateA.verification).toBe('self_reported');
    expect(stateA.progress).toBe(0);
    expect(stateA.consecutiveFailures).toBe(0);

    const stateB = byId.get('skill-b')!;
    expect(stateB.level).toBe(0);
    expect(stateB.status).toBe('available');
    expect(stateB.verification).toBe('self_reported');

    const stateC = byId.get('skill-c')!;
    expect(stateC.level).toBe(0);
    expect(stateC.status).toBe('locked');
    expect(stateC.verification).toBe('self_reported');

    const stateD = byId.get('skill-d')!;
    expect(stateD.level).toBe(1);
    expect(stateD.status).toBe('available');
    expect(stateD.verification).toBe('self_reported');
  });

  it('determines locked vs available correctly when all skills are declared 0', () => {
    const roleSkills = [
      { skillId: 'root-skill', requiredLevel: 2 },
      { skillId: 'dependent-skill', requiredLevel: 2 },
    ];

    const declaredLevels = [
      { skillId: 'root-skill', level: 0 },
      { skillId: 'dependent-skill', level: 0 },
    ];

    const prerequisites = [
      { skillId: 'dependent-skill', prerequisiteSkillId: 'root-skill' },
    ];

    const results = computeInitialSkillStates({
      roleSkills,
      declaredLevels,
      prerequisites,
    });

    const byId = new Map(results.map((r) => [r.skillId, r]));
    expect(byId.get('root-skill')!.status).toBe('available');
    expect(byId.get('dependent-skill')!.status).toBe('locked');
  });

  it('sets status to acquired when declared level exactly equals required level', () => {
    const roleSkills = [{ skillId: 'exact-skill', requiredLevel: 2 }];
    const declaredLevels = [{ skillId: 'exact-skill', level: 2 }];

    const results = computeInitialSkillStates({
      roleSkills,
      declaredLevels,
      prerequisites: [],
    });

    expect(results[0].status).toBe('acquired');
    expect(results[0].level).toBe(2);
  });

  it('never locks a skill that has no prerequisites', () => {
    const roleSkills = [{ skillId: 'no-prereq', requiredLevel: 3 }];
    const declaredLevels = [{ skillId: 'no-prereq', level: 0 }];

    const results = computeInitialSkillStates({
      roleSkills,
      declaredLevels,
      prerequisites: [],
    });

    expect(results[0].status).toBe('available');
  });

  it('evaluates acquired before locked (acquired takes absolute priority)', () => {
    // Skill X requires 2, declared 2, but has prerequisite Y which is declared 0 (< PREREQ_MIN_LEVEL)
    // Per SPEC-001: acquired must be checked before locked!
    const roleSkills = [
      { skillId: 'skill-x', requiredLevel: 2 },
      { skillId: 'skill-y', requiredLevel: 2 },
    ];

    const declaredLevels = [
      { skillId: 'skill-x', level: 2 },
      { skillId: 'skill-y', level: 0 },
    ];

    const prerequisites = [
      { skillId: 'skill-x', prerequisiteSkillId: 'skill-y' },
    ];

    const results = computeInitialSkillStates({
      roleSkills,
      declaredLevels,
      prerequisites,
    });

    const byId = new Map(results.map((r) => [r.skillId, r]));
    expect(byId.get('skill-x')!.status).toBe('acquired');
    expect(byId.get('skill-y')!.status).toBe('available');
  });

  it('defaults undeclared skills to level 0', () => {
    const roleSkills = [{ skillId: 'undeclared-skill', requiredLevel: 2 }];
    const declaredLevels: { skillId: string; level: number }[] = [];

    const results = computeInitialSkillStates({
      roleSkills,
      declaredLevels,
      prerequisites: [],
    });

    expect(results[0].level).toBe(0);
    expect(results[0].status).toBe('available');
    expect(results[0].progress).toBe(0);
    expect(results[0].consecutiveFailures).toBe(0);
    expect(results[0].verification).toBe('self_reported');
  });
});
