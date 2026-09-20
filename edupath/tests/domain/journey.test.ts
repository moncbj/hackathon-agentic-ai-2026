import { describe, it, expect } from 'vitest';
import {
  buildJourneySkeleton,
  BuildJourneySkeletonParams,
  JourneyResource,
} from '@/domain/journey';
import { applyActivityCompletion } from '@/domain/skill-state';

describe('SPEC-003 domain: buildJourneySkeleton', () => {
  it('reproduces the official SPEC-003 example with skills A, B, and C', () => {
    // Skills:
    // A: gap = 1, priority = 10, no prereq -> 300 min
    // B: gap = 2, priority = 8, prereq = A -> 600 min
    // C: gap = 1, priority = 9, no prereq -> 300 min
    // weeklyHours = 5 (300 min/week), MINUTES_PER_LEVEL = 300, WIP_LIMIT = 2
    const params: BuildJourneySkeletonParams = {
      weeklyHours: 5,
      gaps: [
        { skillId: 'skill-A', skillSlug: 'skill-a', name: 'Skill A', level: 0, requiredLevel: 1, gap: 1, priority: 10 },
        { skillId: 'skill-B', skillSlug: 'skill-b', name: 'Skill B', level: 0, requiredLevel: 2, gap: 2, priority: 8 },
        { skillId: 'skill-C', skillSlug: 'skill-c', name: 'Skill C', level: 0, requiredLevel: 1, gap: 1, priority: 9 },
      ],
      learnerSkills: [
        { skillId: 'skill-A', level: 0, status: 'available' },
        { skillId: 'skill-B', level: 0, status: 'locked' },
        { skillId: 'skill-C', level: 0, status: 'available' },
      ],
      prerequisites: [
        { skillId: 'skill-B', prerequisiteSkillId: 'skill-A' },
      ],
      resources: [
        { id: 'res-a', skillId: 'skill-A', title: 'Resource A', url: 'https://example.com/a', type: 'course', level_min: 0, level_max: 2, language: 'es', verified: true },
        { id: 'res-b', skillId: 'skill-B', title: 'Resource B', url: 'https://example.com/b', type: 'course', level_min: 0, level_max: 2, language: 'es', verified: true },
        { id: 'res-c', skillId: 'skill-C', title: 'Resource C', url: 'https://example.com/c', type: 'course', level_min: 0, level_max: 2, language: 'es', verified: true },
      ],
    };

    const skeleton = buildJourneySkeleton(params);

    // Study order must be: A, C, B
    expect(skeleton.studyOrder).toEqual(['skill-a', 'skill-c', 'skill-b']);

    // Exactly 4 weeks
    expect(skeleton.weeks).toHaveLength(4);

    // Week 1: A = 300 minutes
    const week1 = skeleton.weeks[0];
    expect(week1.weekNumber).toBe(1);
    expect(week1.totalMinutes).toBe(300);
    expect(week1.distinctSkills).toEqual(['skill-a']);

    // Week 2: C = 300 minutes
    const week2 = skeleton.weeks[1];
    expect(week2.weekNumber).toBe(2);
    expect(week2.totalMinutes).toBe(300);
    expect(week2.distinctSkills).toEqual(['skill-c']);

    // Week 3: B = 300 minutes
    const week3 = skeleton.weeks[2];
    expect(week3.weekNumber).toBe(3);
    expect(week3.totalMinutes).toBe(300);
    expect(week3.distinctSkills).toEqual(['skill-b']);

    // Week 4: B = 300 minutes
    const week4 = skeleton.weeks[3];
    expect(week4.weekNumber).toBe(4);
    expect(week4.totalMinutes).toBe(300);
    expect(week4.distinctSkills).toEqual(['skill-b']);

    // No backlog
    expect(skeleton.backlog).toHaveLength(0);

    // B never appears before A
    const weekIndexA = skeleton.weeks.findIndex((w) => w.distinctSkills.includes('skill-a'));
    const weekIndexB = skeleton.weeks.findIndex((w) => w.distinctSkills.includes('skill-b'));
    expect(weekIndexA).toBeLessThan(weekIndexB);
  });

  it('respects the 4-week horizon and sends overflow to backlog', () => {
    // 5 skills of 300 minutes each = 1500 minutes total effort
    // With 300 min/week and 4-week horizon = 1200 min capacity.
    // 1 skill should stay in backlog
    const params: BuildJourneySkeletonParams = {
      weeklyHours: 5,
      gaps: [
        { skillId: 's1', skillSlug: 's1', name: 'Skill 1', level: 0, requiredLevel: 1, gap: 1, priority: 10 },
        { skillId: 's2', skillSlug: 's2', name: 'Skill 2', level: 0, requiredLevel: 1, gap: 1, priority: 9 },
        { skillId: 's3', skillSlug: 's3', name: 'Skill 3', level: 0, requiredLevel: 1, gap: 1, priority: 8 },
        { skillId: 's4', skillSlug: 's4', name: 'Skill 4', level: 0, requiredLevel: 1, gap: 1, priority: 7 },
        { skillId: 's5', skillSlug: 's5', name: 'Skill 5', level: 0, requiredLevel: 1, gap: 1, priority: 6 },
      ],
      learnerSkills: [
        { skillId: 's1', level: 0, status: 'available' },
        { skillId: 's2', level: 0, status: 'available' },
        { skillId: 's3', level: 0, status: 'available' },
        { skillId: 's4', level: 0, status: 'available' },
        { skillId: 's5', level: 0, status: 'available' },
      ],
      prerequisites: [],
      resources: [],
    };

    const skeleton = buildJourneySkeleton(params);

    expect(skeleton.weeks).toHaveLength(4);
    expect(skeleton.backlog).toHaveLength(1);
    expect(skeleton.backlog[0].skillSlug).toBe('s5');
    expect(skeleton.backlog[0].remainingMinutes).toBe(300);
  });

  it('boosts effective priority for struggling skills by STRUGGLE_BOOST (1.5)', () => {
    // s1 has priority 7, but is struggling -> effectivePriority = 7 * 1.5 = 10.5
    // s2 has priority 10, available -> effectivePriority = 10
    // s1 should be scheduled before s2
    const params: BuildJourneySkeletonParams = {
      weeklyHours: 5,
      gaps: [
        { skillId: 's1', skillSlug: 's1', name: 'Skill 1 (Struggling)', level: 0, requiredLevel: 1, gap: 1, priority: 7 },
        { skillId: 's2', skillSlug: 's2', name: 'Skill 2', level: 0, requiredLevel: 1, gap: 1, priority: 10 },
      ],
      learnerSkills: [
        { skillId: 's1', level: 0, status: 'struggling' },
        { skillId: 's2', level: 0, status: 'available' },
      ],
      prerequisites: [],
      resources: [],
    };

    const skeleton = buildJourneySkeleton(params);

    expect(skeleton.studyOrder[0]).toBe('s1');
    expect(skeleton.studyOrder[1]).toBe('s2');
  });

  it('filters out skills with gap === 0 or status === acquired', () => {
    const params: BuildJourneySkeletonParams = {
      weeklyHours: 5,
      gaps: [
        { skillId: 's1', skillSlug: 's1', name: 'Skill 1', level: 2, requiredLevel: 2, gap: 0, priority: 10 },
        { skillId: 's2', skillSlug: 's2', name: 'Skill 2', level: 1, requiredLevel: 1, gap: 0, priority: 9 },
        { skillId: 's3', skillSlug: 's3', name: 'Skill 3', level: 0, requiredLevel: 1, gap: 1, priority: 8 },
      ],
      learnerSkills: [
        { skillId: 's1', level: 2, status: 'acquired' },
        { skillId: 's2', level: 1, status: 'acquired' },
        { skillId: 's3', level: 0, status: 'available' },
      ],
      prerequisites: [],
      resources: [],
    };

    const skeleton = buildJourneySkeleton(params);

    expect(skeleton.studyOrder).toEqual(['s3']);
    expect(skeleton.scheduledSkills).toHaveLength(1);
    expect(skeleton.scheduledSkills[0].skillSlug).toBe('s3');
  });

  it('splits portions into 15-minute multiple slots and includes project when gap >= 2', () => {
    const params: BuildJourneySkeletonParams = {
      weeklyHours: 5, // 300 min
      gaps: [
        { skillId: 's1', skillSlug: 's1', name: 'Skill 1', level: 0, requiredLevel: 2, gap: 2, priority: 10 },
      ],
      learnerSkills: [
        { skillId: 's1', level: 0, status: 'available' },
      ],
      prerequisites: [],
      resources: [
        { id: 'res-1', skillId: 's1', title: 'Resource 1', url: 'https://ex.com/1', type: 'video', level_min: 0, level_max: 2, language: 'es', verified: true },
      ],
    };

    const skeleton = buildJourneySkeleton(params);

    // Effort = 2 * 300 = 600 min -> 2 weeks of 300 min each
    expect(skeleton.weeks).toHaveLength(2);

    for (const week of skeleton.weeks) {
      for (const slot of week.slots) {
        expect(slot.minutes % 15).toBe(0);
        expect(slot.slotId).toMatch(/^slot-w\d+-s1-/);
      }
    }

    // Week 1 has resource
    expect(skeleton.weeks[0].slots.some((s) => s.type === 'resource')).toBe(true);

    // Week 2 (final portion for gap 2) has a project slot
    expect(skeleton.weeks[1].slots.some((s) => s.type === 'project')).toBe(true);
  });

  it('converts resource slot to practice and sets noResource = true when no suitable resource exists', () => {
    const params: BuildJourneySkeletonParams = {
      weeklyHours: 5,
      gaps: [
        { skillId: 's1', skillSlug: 's1', name: 'Skill 1', level: 3, requiredLevel: 4, gap: 1, priority: 10 },
      ],
      learnerSkills: [
        { skillId: 's1', level: 3, status: 'available' },
      ],
      prerequisites: [],
      resources: [
        // Level range 0..1 does not cover current level 3
        { id: 'res-low', skillId: 's1', title: 'Beginner Only', url: 'https://ex.com/low', type: 'docs', level_min: 0, level_max: 1, language: 'es', verified: true },
      ],
    };

    const skeleton = buildJourneySkeleton(params);

    const slots = skeleton.weeks[0].slots;
    const noResourceSlot = slots.find((s) => s.noResource);
    expect(noResourceSlot).toBeDefined();
    expect(noResourceSlot?.type).toBe('practice');
  });

  it('prefers verified resources and matching language', () => {
    const resources: JourneyResource[] = [
      { id: 'r1', skillId: 's1', title: 'Unverified EN', url: 'https://ex.com/1', type: 'article', level_min: 0, level_max: 2, language: 'en', verified: false },
      { id: 'r2', skillId: 's1', title: 'Verified ES', url: 'https://ex.com/2', type: 'article', level_min: 0, level_max: 2, language: 'es', verified: true },
      { id: 'r3', skillId: 's1', title: 'Verified EN', url: 'https://ex.com/3', type: 'article', level_min: 0, level_max: 2, language: 'en', verified: true },
    ];

    const params: BuildJourneySkeletonParams = {
      weeklyHours: 5,
      gaps: [
        { skillId: 's1', skillSlug: 's1', name: 'Skill 1', level: 0, requiredLevel: 1, gap: 1, priority: 10 },
      ],
      learnerSkills: [
        { skillId: 's1', level: 0, status: 'available' },
      ],
      prerequisites: [],
      resources,
      config: { learnerLanguage: 'es' },
    };

    const skeleton = buildJourneySkeleton(params);
    const resourceSlot = skeleton.weeks[0].slots.find((s) => s.type === 'resource');
    expect(resourceSlot?.resource?.id).toBe('r2'); // Verified ES
  });

  it('avoids previously used resources for struggling skills (reinforcement)', () => {
    const resources: JourneyResource[] = [
      { id: 'res-used', skillId: 's1', title: 'Used Resource', url: 'https://ex.com/used', type: 'course', level_min: 0, level_max: 2, language: 'es', verified: true },
      { id: 'res-new', skillId: 's1', title: 'New Resource', url: 'https://ex.com/new', type: 'video', level_min: 0, level_max: 2, language: 'es', verified: true },
    ];

    const params: BuildJourneySkeletonParams = {
      weeklyHours: 5,
      gaps: [
        { skillId: 's1', skillSlug: 's1', name: 'Skill 1', level: 0, requiredLevel: 1, gap: 1, priority: 10 },
      ],
      learnerSkills: [
        { skillId: 's1', level: 0, status: 'struggling' },
      ],
      prerequisites: [],
      resources,
      previousJourneys: [
        {
          id: 'prev-1',
          activities: [
            { skillId: 's1', type: 'course', resourceId: 'res-used' },
          ],
        },
      ],
    };

    const skeleton = buildJourneySkeleton(params);
    const resourceSlot = skeleton.weeks[0].slots.find((s) => s.type === 'resource');
    expect(resourceSlot?.resource?.id).toBe('res-new');
    expect(resourceSlot?.reinforcement).toBe(true);
  });
});

describe('SPEC-003 domain: applyActivityCompletion', () => {
  it('applies the exact progress formula: round(minutes / (gap * 300) * 100)', () => {
    // gap = 1, minutesPerLevel = 300
    // activity.minutes = 45 -> round(45 / 300 * 100) = round(15) = 15
    const initial = {
      skillId: 's1',
      level: 1,
      status: 'available' as const,
      progress: 0,
    };

    const updated = applyActivityCompletion(initial, { minutes: 45 }, 1);
    expect(updated.progress).toBe(15);
    expect(updated.status).toBe('in_progress');
    expect(updated.level).toBe(1); // LEVEL DOES NOT CHANGE
    expect(updated.readyForAssessment).toBe(false);
  });

  it('caps progress at 100 and marks readyForAssessment when progress reaches 100', () => {
    const initial = {
      skillId: 's1',
      level: 1,
      status: 'in_progress' as const,
      progress: 85,
    };

    // 60 minutes out of 300 = +20% -> 85 + 20 = 105 -> capped at 100
    const updated = applyActivityCompletion(initial, { minutes: 60 }, 1);
    expect(updated.progress).toBe(100);
    expect(updated.readyForAssessment).toBe(true);
    expect(updated.level).toBe(1); // LEVEL NEVER CHANGES IN SPEC-003
  });

  it('handles gap = 2 correctly: progress based on 2 * 300 = 600 min', () => {
    const initial = {
      skillId: 's1',
      level: 0,
      status: 'available' as const,
      progress: 0,
    };

    // 150 minutes out of (2 * 300 = 600) = 25%
    const updated = applyActivityCompletion(initial, { minutes: 150 }, 2);
    expect(updated.progress).toBe(25);
    expect(updated.status).toBe('in_progress');
    expect(updated.readyForAssessment).toBe(false);
  });
});
