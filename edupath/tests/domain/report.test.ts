// tests/domain/report.test.ts
// Unit tests for buildProgressReport and candidate ordering (SPEC-005 §3.2, §4.7)

import { describe, it, expect } from 'vitest';
import { buildProgressReport, ReportSkillInput } from '@/domain/report';

describe('domain/report > buildProgressReport', () => {
  it('produces the exact candidate order from the SPEC-005 §3.2 acceptance test', () => {
    // Scenario from SPEC-005:
    // A: acquired and verified
    // B: in_progress at 40%
    // C: available with gap 2
    // D: acquired and self_reported with weight 5 (needsVerification)
    // E: struggling
    // F: progress 100 (ready to assess)
    // Expected order: assess F, reinforce E, verify D, continue the week.

    const skills: ReportSkillInput[] = [
      {
        skillId: 's-a',
        slug: 'a',
        name: 'Skill A',
        level: 2,
        requiredLevel: 2,
        weight: 3,
        verification: 'verified',
        status: 'acquired',
        progress: 0,
      },
      {
        skillId: 's-b',
        slug: 'b',
        name: 'Skill B',
        level: 1,
        requiredLevel: 2,
        weight: 3,
        verification: 'self_reported',
        status: 'in_progress',
        progress: 40,
      },
      {
        skillId: 's-c',
        slug: 'c',
        name: 'Skill C',
        level: 0,
        requiredLevel: 2,
        weight: 3,
        verification: 'self_reported',
        status: 'available',
        progress: 0,
      },
      {
        skillId: 's-d',
        slug: 'd',
        name: 'Skill D',
        level: 3,
        requiredLevel: 3,
        weight: 5,
        verification: 'self_reported',
        status: 'acquired',
        progress: 0,
      },
      {
        skillId: 's-e',
        slug: 'e',
        name: 'Skill E',
        level: 1,
        requiredLevel: 2,
        weight: 3,
        verification: 'self_reported',
        status: 'struggling',
        progress: 10,
        consecutiveFailures: 2,
      },
      {
        skillId: 's-f',
        slug: 'f',
        name: 'Skill F',
        level: 1,
        requiredLevel: 2,
        weight: 4,
        verification: 'self_reported',
        status: 'in_progress',
        progress: 100,
      },
    ];

    const report = buildProgressReport({
      skills,
      activity: {
        completedThisWeek: 1,
        totalThisWeek: 3,
        completedOverall: 4,
        skippedOverall: 0,
      },
      assessments: {
        totalCount: 2,
        lastThree: [
          { skill: 'Skill A', score: 0.85, date: '2026-09-18T10:00:00Z' },
        ],
      },
      journey: {
        currentVersion: 2,
        latestChangeSummary: 'Reinforced Skill E due to difficulties.',
      },
    });

    // 1. Verify Next Step Candidates order and candidateIds
    expect(report.nextStepCandidates).toHaveLength(4);

    expect(report.nextStepCandidates[0]).toMatchObject({
      candidateId: 'assess_f',
      actionType: 'start_assessment',
      skillSlug: 'f',
    });

    expect(report.nextStepCandidates[1]).toMatchObject({
      candidateId: 'reinforce_e',
      actionType: 'open_skill',
      skillSlug: 'e',
    });

    expect(report.nextStepCandidates[2]).toMatchObject({
      candidateId: 'verify_d',
      actionType: 'start_assessment',
      skillSlug: 'd',
    });

    expect(report.nextStepCandidates[3]).toMatchObject({
      candidateId: 'continue_week',
      actionType: 'open_journey',
    });

    // 2. Verify Acquired skills block
    expect(report.acquired).toHaveLength(2);
    expect(report.acquired.map((s) => s.slug)).toEqual(['a', 'd']);
    expect(report.acquired.find((s) => s.slug === 'a')?.verification).toBe('verified');
    expect(report.acquired.find((s) => s.slug === 'd')?.verification).toBe('self_reported');

    // 3. Verify In Progress skills block
    expect(report.inProgress).toHaveLength(2);
    expect(report.inProgress.map((s) => s.slug)).toEqual(['b', 'f']);

    // 4. Verify Struggling skills block
    expect(report.struggling).toHaveLength(1);
    expect(report.struggling[0]).toMatchObject({
      slug: 'e',
      consecutiveFailures: 2,
    });

    // 5. Verify toVerify block (D has gap=0, self_reported, weight=5 >= 4)
    expect(report.toVerify).toHaveLength(1);
    expect(report.toVerify[0]).toMatchObject({
      slug: 'd',
      weight: 5,
    });

    // 6. Verify remainingGaps
    expect(report.remainingGaps.length).toBeGreaterThan(0);
    // Skill C has gap 2, B has gap 1, E has gap 1, F has gap 1
    expect(report.remainingGaps.map((g) => g.slug)).toContain('c');
    expect(report.remainingGaps.map((g) => g.slug)).toContain('b');
  });

  it('provides fallback review_plan candidate when no other actions apply', () => {
    const report = buildProgressReport({
      skills: [
        {
          skillId: 's-1',
          slug: 'mastered-skill',
          name: 'Mastered Skill',
          level: 3,
          requiredLevel: 3,
          weight: 3, // < 4, so not needsVerification
          verification: 'verified',
          status: 'acquired',
          progress: 0,
        },
      ],
      activity: {
        completedThisWeek: 2,
        totalThisWeek: 2, // No pending this week!
        completedOverall: 2,
        skippedOverall: 0,
      },
      assessments: {
        totalCount: 1,
        lastThree: [],
      },
      journey: {
        currentVersion: 1,
        latestChangeSummary: 'Initial plan.',
      },
    });

    expect(report.nextStepCandidates).toHaveLength(1);
    expect(report.nextStepCandidates[0]).toMatchObject({
      candidateId: 'review_plan',
      actionType: 'open_journey',
    });
  });

  it('caps candidates at a maximum of 5', () => {
    const skills: ReportSkillInput[] = [
      { skillId: '1', slug: 's1', name: 'S1', level: 1, requiredLevel: 2, weight: 5, verification: 'verified', status: 'struggling', progress: 10 },
      { skillId: '2', slug: 's2', name: 'S2', level: 1, requiredLevel: 2, weight: 4, verification: 'verified', status: 'struggling', progress: 10 },
      { skillId: '3', slug: 's3', name: 'S3', level: 1, requiredLevel: 2, weight: 3, verification: 'verified', status: 'struggling', progress: 10 },
      { skillId: '4', slug: 's4', name: 'S4', level: 1, requiredLevel: 2, weight: 2, verification: 'verified', status: 'struggling', progress: 10 },
      { skillId: '5', slug: 's5', name: 'S5', level: 1, requiredLevel: 2, weight: 1, verification: 'verified', status: 'struggling', progress: 10 },
      { skillId: '6', slug: 's6', name: 'S6', level: 1, requiredLevel: 2, weight: 1, verification: 'verified', status: 'struggling', progress: 10 },
    ];

    const report = buildProgressReport({
      skills,
      activity: { completedThisWeek: 0, totalThisWeek: 2, completedOverall: 0, skippedOverall: 0 },
      assessments: { totalCount: 0, lastThree: [] },
      journey: { currentVersion: 1, latestChangeSummary: '' },
    });

    expect(report.nextStepCandidates).toHaveLength(5);
  });
});
