// tests/domain/gaps.test.ts
// Comprehensive unit tests for deterministic gap analysis (SPEC-002)

import { describe, it, expect } from 'vitest';
import {
  computeGapAnalysis,
  GapAnalysisRoleSkill,
  GapAnalysisLearnerSkill,
  GapAnalysisPrerequisite,
} from '@/domain/gaps';

describe('domain/gaps - computeGapAnalysis', () => {
  it('replicates the exact example from SPEC-002 section 3.1', () => {
    // Example from SPEC-002:
    // Skill A: required 3, weight 4, level 1, prereq: none -> gap 2, depWithGap 1 (B), priority: 4 * 2 * 1.25 = 10, verify: No
    // Skill B: required 3, weight 5, level 0, prereq: A -> gap 3, depWithGap 0, priority: 5 * 3 * 1 = 15, verify: No
    // Skill C: required 2, weight 3, level 2 (self_reported), prereq: none -> gap 0, depWithGap 0, priority: 0, verify: No (weight 3 < 4)
    // Skill D: required 3, weight 5, level 3 (self_reported), prereq: none -> gap 0, depWithGap 0, priority: 0, verify: Yes (weight 5 >= 4)
    const roleSkills: GapAnalysisRoleSkill[] = [
      { skillId: 'skill-a', skillSlug: 'skill-a', name: 'Skill A', requiredLevel: 3, weight: 4 },
      { skillId: 'skill-b', skillSlug: 'skill-b', name: 'Skill B', requiredLevel: 3, weight: 5 },
      { skillId: 'skill-c', skillSlug: 'skill-c', name: 'Skill C', requiredLevel: 2, weight: 3 },
      { skillId: 'skill-d', skillSlug: 'skill-d', name: 'Skill D', requiredLevel: 3, weight: 5 },
    ];

    const learnerSkills: GapAnalysisLearnerSkill[] = [
      { skillId: 'skill-a', level: 1, verification: 'self_reported' },
      { skillId: 'skill-b', level: 0, verification: 'self_reported' },
      { skillId: 'skill-c', level: 2, verification: 'self_reported' },
      { skillId: 'skill-d', level: 3, verification: 'self_reported' },
    ];

    const prerequisites: GapAnalysisPrerequisite[] = [
      { skillId: 'skill-b', prerequisiteSkillId: 'skill-a' },
    ];

    const results = computeGapAnalysis({ roleSkills, learnerSkills, prerequisites });

    expect(results).toHaveLength(4);

    // Order should be B (15), A (10), C (0, depth 0, name C), D (0, depth 0, name D)
    expect(results[0].skillSlug).toBe('skill-b');
    expect(results[0].gap).toBe(3);
    expect(results[0].dependentsWithGap).toBe(0);
    expect(results[0].priority).toBe(15);
    expect(results[0].needsVerification).toBe(false);
    expect(results[0].depth).toBe(1);

    expect(results[1].skillSlug).toBe('skill-a');
    expect(results[1].gap).toBe(2);
    expect(results[1].dependentsWithGap).toBe(1);
    expect(results[1].priority).toBe(10);
    expect(results[1].needsVerification).toBe(false);
    expect(results[1].depth).toBe(0);

    expect(results[2].skillSlug).toBe('skill-c');
    expect(results[2].gap).toBe(0);
    expect(results[2].dependentsWithGap).toBe(0);
    expect(results[2].priority).toBe(0);
    expect(results[2].needsVerification).toBe(false);
    expect(results[2].depth).toBe(0);

    expect(results[3].skillSlug).toBe('skill-d');
    expect(results[3].gap).toBe(0);
    expect(results[3].dependentsWithGap).toBe(0);
    expect(results[3].priority).toBe(0);
    expect(results[3].needsVerification).toBe(true);
    expect(results[3].depth).toBe(0);
  });

  it('handles zero gap when learner level exceeds or equals required level', () => {
    const roleSkills: GapAnalysisRoleSkill[] = [
      { skillId: 's1', skillSlug: 's1', name: 'S1', requiredLevel: 2, weight: 4 },
      { skillId: 's2', skillSlug: 's2', name: 'S2', requiredLevel: 2, weight: 4 },
    ];
    const learnerSkills: GapAnalysisLearnerSkill[] = [
      { skillId: 's1', level: 2, verification: 'verified' },
      { skillId: 's2', level: 4, verification: 'verified' },
    ];
    const results = computeGapAnalysis({ roleSkills, learnerSkills, prerequisites: [] });

    expect(results[0].gap).toBe(0);
    expect(results[0].priority).toBe(0);
    expect(results[1].gap).toBe(0);
    expect(results[1].priority).toBe(0);
  });

  it('defaults missing learner skill to level 0 and verification self_reported', () => {
    const roleSkills: GapAnalysisRoleSkill[] = [
      { skillId: 's1', skillSlug: 's1', name: 'Skill 1', requiredLevel: 3, weight: 5 },
    ];
    const results = computeGapAnalysis({ roleSkills, learnerSkills: [], prerequisites: [] });

    expect(results).toHaveLength(1);
    expect(results[0].level).toBe(0);
    expect(results[0].gap).toBe(3);
    expect(results[0].priority).toBe(15);
    expect(results[0].needsVerification).toBe(false);
  });

  it('counts only direct dependents with gap > 0 and ignores grandchildren', () => {
    // Chain: A -> B -> C
    // B has prereq A. C has prereq B.
    // A has level 0 (gap 2), B has level 0 (gap 2), C has level 0 (gap 2)
    // A has direct dependent B (gap 2). C is indirect!
    // A's dependentsWithGap MUST be 1, NOT 2!
    const roleSkills: GapAnalysisRoleSkill[] = [
      { skillId: 'a', skillSlug: 'a', name: 'A', requiredLevel: 2, weight: 2 },
      { skillId: 'b', skillSlug: 'b', name: 'B', requiredLevel: 2, weight: 2 },
      { skillId: 'c', skillSlug: 'c', name: 'C', requiredLevel: 2, weight: 2 },
    ];
    const learnerSkills: GapAnalysisLearnerSkill[] = [
      { skillId: 'a', level: 0, verification: 'self_reported' },
      { skillId: 'b', level: 0, verification: 'self_reported' },
      { skillId: 'c', level: 0, verification: 'self_reported' },
    ];
    const prerequisites: GapAnalysisPrerequisite[] = [
      { skillId: 'b', prerequisiteSkillId: 'a' },
      { skillId: 'c', prerequisiteSkillId: 'b' },
    ];

    const results = computeGapAnalysis({ roleSkills, learnerSkills, prerequisites });
    const resultA = results.find((r) => r.skillId === 'a')!;
    const resultB = results.find((r) => r.skillId === 'b')!;
    const resultC = results.find((r) => r.skillId === 'c')!;

    expect(resultA.dependentsWithGap).toBe(1); // Only B
    expect(resultA.depth).toBe(0);

    expect(resultB.dependentsWithGap).toBe(1); // Only C
    expect(resultB.depth).toBe(1);

    expect(resultC.dependentsWithGap).toBe(0); // None
    expect(resultC.depth).toBe(2);
  });

  it('does not count direct dependents if their gap is 0', () => {
    // B depends on A, but B's level >= requiredLevel (gap = 0)
    const roleSkills: GapAnalysisRoleSkill[] = [
      { skillId: 'a', skillSlug: 'a', name: 'A', requiredLevel: 2, weight: 4 },
      { skillId: 'b', skillSlug: 'b', name: 'B', requiredLevel: 2, weight: 4 },
    ];
    const learnerSkills: GapAnalysisLearnerSkill[] = [
      { skillId: 'a', level: 1, verification: 'self_reported' }, // gap 1
      { skillId: 'b', level: 2, verification: 'verified' },      // gap 0
    ];
    const prerequisites: GapAnalysisPrerequisite[] = [
      { skillId: 'b', prerequisiteSkillId: 'a' },
    ];

    const results = computeGapAnalysis({ roleSkills, learnerSkills, prerequisites });
    const resultA = results.find((r) => r.skillId === 'a')!;

    expect(resultA.dependentsWithGap).toBe(0);
    expect(resultA.priority).toBe(4 * 1 * 1); // 4
  });

  it('counts multiple direct dependents with gap > 0', () => {
    // B and C both depend on A. Both B and C have gap > 0.
    const roleSkills: GapAnalysisRoleSkill[] = [
      { skillId: 'a', skillSlug: 'a', name: 'A', requiredLevel: 2, weight: 2 },
      { skillId: 'b', skillSlug: 'b', name: 'B', requiredLevel: 2, weight: 2 },
      { skillId: 'c', skillSlug: 'c', name: 'C', requiredLevel: 2, weight: 2 },
    ];
    const learnerSkills: GapAnalysisLearnerSkill[] = [];
    const prerequisites: GapAnalysisPrerequisite[] = [
      { skillId: 'b', prerequisiteSkillId: 'a' },
      { skillId: 'c', prerequisiteSkillId: 'a' },
    ];

    const results = computeGapAnalysis({ roleSkills, learnerSkills, prerequisites });
    const resultA = results.find((r) => r.skillId === 'a')!;

    expect(resultA.dependentsWithGap).toBe(2);
    // priority: weight(2) * gap(2) * (1 + 0.25 * 2) = 4 * 1.5 = 6
    expect(resultA.priority).toBe(6);
  });

  it('deduplicates duplicate prerequisite edges', () => {
    const roleSkills: GapAnalysisRoleSkill[] = [
      { skillId: 'a', skillSlug: 'a', name: 'A', requiredLevel: 2, weight: 2 },
      { skillId: 'b', skillSlug: 'b', name: 'B', requiredLevel: 2, weight: 2 },
    ];
    const prerequisites: GapAnalysisPrerequisite[] = [
      { skillId: 'b', prerequisiteSkillId: 'a' },
      { skillId: 'b', prerequisiteSkillId: 'a' }, // duplicate
    ];

    const results = computeGapAnalysis({ roleSkills, learnerSkills: [], prerequisites });
    const resultA = results.find((r) => r.skillId === 'a')!;

    expect(resultA.dependentsWithGap).toBe(1);
    expect(resultA.priority).toBe(2 * 2 * (1 + 0.25 * 1)); // 5
  });

  it('evaluates needsVerification correctly according to VERIFY_MIN_WEIGHT and self_reported', () => {
    const roleSkills: GapAnalysisRoleSkill[] = [
      { skillId: 'w5_self', skillSlug: 'w5_self', name: 'W5 Self', requiredLevel: 2, weight: 5 },
      { skillId: 'w4_self', skillSlug: 'w4_self', name: 'W4 Self', requiredLevel: 2, weight: 4 },
      { skillId: 'w3_self', skillSlug: 'w3_self', name: 'W3 Self', requiredLevel: 2, weight: 3 },
      { skillId: 'w5_ver', skillSlug: 'w5_ver', name: 'W5 Ver', requiredLevel: 2, weight: 5 },
      { skillId: 'w5_gap', skillSlug: 'w5_gap', name: 'W5 Gap', requiredLevel: 2, weight: 5 },
    ];
    const learnerSkills: GapAnalysisLearnerSkill[] = [
      { skillId: 'w5_self', level: 2, verification: 'self_reported' }, // gap 0, weight 5 >= 4 -> true
      { skillId: 'w4_self', level: 2, verification: 'self_reported' }, // gap 0, weight 4 >= 4 -> true
      { skillId: 'w3_self', level: 2, verification: 'self_reported' }, // gap 0, weight 3 < 4 -> false
      { skillId: 'w5_ver', level: 2, verification: 'verified' },       // gap 0, verified -> false
      { skillId: 'w5_gap', level: 1, verification: 'self_reported' },  // gap 1 > 0 -> false
    ];

    const results = computeGapAnalysis({ roleSkills, learnerSkills, prerequisites: [] });

    expect(results.find((r) => r.skillId === 'w5_self')!.needsVerification).toBe(true);
    expect(results.find((r) => r.skillId === 'w4_self')!.needsVerification).toBe(true);
    expect(results.find((r) => r.skillId === 'w3_self')!.needsVerification).toBe(false);
    expect(results.find((r) => r.skillId === 'w5_ver')!.needsVerification).toBe(false);
    expect(results.find((r) => r.skillId === 'w5_gap')!.needsVerification).toBe(false);
  });

  it('handles zero weight without errors', () => {
    const roleSkills: GapAnalysisRoleSkill[] = [
      { skillId: 'zero', skillSlug: 'zero', name: 'Zero', requiredLevel: 2, weight: 0 },
    ];
    const results = computeGapAnalysis({ roleSkills, learnerSkills: [], prerequisites: [] });
    expect(results[0].priority).toBe(0);
    expect(results[0].needsVerification).toBe(false);
  });

  it('breaks ties deterministically using depth ASC, name ASC, and slug ASC', () => {
    // 3 skills with same priority 0:
    // S_depth1: depth 1, name "Z"
    // S_depth0_b: depth 0, name "Beta"
    // S_depth0_a: depth 0, name "Alpha"
    const roleSkills: GapAnalysisRoleSkill[] = [
      { skillId: 's_d1', skillSlug: 's_d1', name: 'Z', requiredLevel: 1, weight: 1 },
      { skillId: 's_d0_b', skillSlug: 's_d0_b', name: 'Beta', requiredLevel: 1, weight: 1 },
      { skillId: 's_d0_a', skillSlug: 's_d0_a', name: 'Alpha', requiredLevel: 1, weight: 1 },
      { skillId: 'root', skillSlug: 'root', name: 'Root', requiredLevel: 1, weight: 1 },
    ];
    const learnerSkills: GapAnalysisLearnerSkill[] = [
      { skillId: 's_d1', level: 1, verification: 'verified' },
      { skillId: 's_d0_b', level: 1, verification: 'verified' },
      { skillId: 's_d0_a', level: 1, verification: 'verified' },
      { skillId: 'root', level: 1, verification: 'verified' },
    ];
    const prerequisites: GapAnalysisPrerequisite[] = [
      { skillId: 's_d1', prerequisiteSkillId: 'root' },
    ];

    const results = computeGapAnalysis({ roleSkills, learnerSkills, prerequisites });

    // All priority = 0.
    // Depth 0 items first: Alpha, Beta, Root (sorted by name).
    // Depth 1 item last: Z.
    expect(results.map((r) => r.name)).toEqual(['Alpha', 'Beta', 'Root', 'Z']);
  });

  it('throws a domain error if a circular dependency cycle exists in prerequisites', () => {
    const roleSkills: GapAnalysisRoleSkill[] = [
      { skillId: 'c1', skillSlug: 'c1', name: 'C1', requiredLevel: 2, weight: 2 },
      { skillId: 'c2', skillSlug: 'c2', name: 'C2', requiredLevel: 2, weight: 2 },
    ];
    const prerequisites: GapAnalysisPrerequisite[] = [
      { skillId: 'c1', prerequisiteSkillId: 'c2' },
      { skillId: 'c2', prerequisiteSkillId: 'c1' },
    ];

    expect(() => {
      computeGapAnalysis({ roleSkills, learnerSkills: [], prerequisites });
    }).toThrow(/Cycle detected in prerequisites graph/);
  });
});
