import { describe, it, expect } from 'vitest';
import {
    addExtraSkill,
    sanitizeProposals,
    sanitizeUnmapped,
} from '@/app/onboarding/cv-proposals';
import { groupSkillsByCategory } from '@/app/onboarding/skill-groups';
import { LIMITS, validateCvText } from '@/app/onboarding/validation';
import { MOCK_ROLE } from '@/app/_lib/api/onboarding';
import type { ProposedSkill } from '@/app/_lib/api/onboarding-types';

const slugs = MOCK_ROLE.skills.map((skill) => skill.slug);

function proposal(overrides: Partial<ProposedSkill> = {}): ProposedSkill {
    return { skillSlug: 'sql', proposedLevel: 3, rationale: 'Mentions SQL.', confidence: 'high', ...overrides };
}

describe('sanitizeProposals', () => {
    it('keeps valid proposals for skills of the role', () => {
        expect(sanitizeProposals([proposal(), proposal({ skillSlug: 'pandas', proposedLevel: 2 })], slugs)).toHaveLength(2);
    });

    it('drops proposals for a skill that does not exist in the role', () => {
        const result = sanitizeProposals([proposal({ skillSlug: 'kubernetes' }), proposal()], slugs);
        expect(result.map((item) => item.skillSlug)).toEqual(['sql']);
    });

    it('drops out-of-range levels and duplicated skills', () => {
        const result = sanitizeProposals(
            [
                proposal({ proposedLevel: 5 as never }),
                proposal({ skillSlug: 'pandas', proposedLevel: 2 }),
                proposal({ skillSlug: 'pandas', proposedLevel: 4 }),
            ],
            slugs,
        );
        expect(result).toEqual([proposal({ skillSlug: 'pandas', proposedLevel: 2 })]);
    });

    it('handles a missing list', () => {
        expect(sanitizeProposals(undefined, slugs)).toEqual([]);
    });
});

describe('sanitizeUnmapped', () => {
    it('trims names, drops empty ones, invalid levels and duplicates', () => {
        const result = sanitizeUnmapped([
            { name: ' Tableau ', proposedLevel: 2, rationale: 'a' },
            { name: 'tableau', proposedLevel: 3, rationale: 'b' },
            { name: '   ', proposedLevel: 1, rationale: 'c' },
            { name: 'Power BI', proposedLevel: 9 as never, rationale: 'd' },
        ]);
        expect(result).toEqual([{ name: 'Tableau', proposedLevel: 2, rationale: 'a' }]);
    });
});

describe('addExtraSkill', () => {
    it('adds a new skill', () => {
        const result = addExtraSkill([], { name: ' Tableau ', level: 2 });
        expect(result.status).toBe('added');
        expect(result.extraSkills).toEqual([{ name: 'Tableau', level: 2 }]);
    });

    it('ignores a duplicate name, case-insensitive', () => {
        const result = addExtraSkill([{ name: 'Tableau', level: 2 }], { name: 'tableau', level: 4 });
        expect(result.status).toBe('duplicate');
        expect(result.extraSkills).toEqual([{ name: 'Tableau', level: 2 }]);
    });

    it('refuses to go over the limit of other skills', () => {
        const full = Array.from({ length: LIMITS.extraSkillsMax }, (_, index) => ({ name: `Skill ${index}`, level: 1 as const }));
        const result = addExtraSkill(full, { name: 'One more', level: 1 });
        expect(result.status).toBe('limit');
        expect(result.extraSkills).toHaveLength(LIMITS.extraSkillsMax);
    });

    it('truncates very long names to the allowed length', () => {
        const result = addExtraSkill([], { name: 'x'.repeat(200), level: 1 });
        expect(result.extraSkills[0].name).toHaveLength(LIMITS.extraSkillNameMax);
    });
});

describe('validateCvText', () => {
    it('asks for text when it is empty or too short', () => {
        expect(validateCvText('')).not.toBeNull();
        expect(validateCvText('   short   ')).not.toBeNull();
    });

    it('accepts a reasonable text and rejects an excessive one', () => {
        expect(validateCvText('Built weekly sales reports with SQL and Excel.')).toBeNull();
        expect(validateCvText('a'.repeat(LIMITS.cvTextMax + 1))).not.toBeNull();
    });
});

describe('groupSkillsByCategory', () => {
    it('groups by category keeping the order of first appearance', () => {
        const groups = groupSkillsByCategory(MOCK_ROLE.skills);
        expect(groups.map((group) => group.category)).toEqual([
            'Data foundations',
            'Statistics',
            'Programming',
            'Data preparation',
            'Communication',
        ]);
        expect(groups.flatMap((group) => group.skills)).toHaveLength(MOCK_ROLE.skills.length);
    });
});
