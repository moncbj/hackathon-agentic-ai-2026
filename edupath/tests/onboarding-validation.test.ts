import { describe, it, expect } from 'vitest';
import {
    INITIAL_VALUES,
    buildOnboardingRequest,
    isSkillLevel,
    validateGoalStep,
    validateSkillsStep,
    validateStep,
    validateTutorStep,
    type OnboardingFormValues,
} from '@/app/onboarding/validation';

function makeValues(overrides: Partial<OnboardingFormValues> = {}): OnboardingFormValues {
    return {
        ...INITIAL_VALUES,
        name: 'Alex',
        targetRoleSlug: 'data-analyst-junior',
        weeklyHours: '8',
        ...overrides,
    };
}

describe('isSkillLevel', () => {
    it('accepts integers from 0 to 4 only', () => {
        expect([0, 1, 2, 3, 4].every(isSkillLevel)).toBe(true);
        expect(isSkillLevel(-1)).toBe(false);
        expect(isSkillLevel(5)).toBe(false);
        expect(isSkillLevel(2.5)).toBe(false);
        expect(isSkillLevel('2')).toBe(false);
    });
});

describe('validateGoalStep', () => {
    it('passes with valid values', () => {
        expect(validateGoalStep(makeValues())).toEqual({});
    });

    it('requires name, role and hours', () => {
        const errors = validateGoalStep(makeValues({ name: '   ', targetRoleSlug: '', weeklyHours: '' }));
        expect(Object.keys(errors).sort()).toEqual(['name', 'targetRoleSlug', 'weeklyHours']);
    });

    it('enforces the hours range 1 to 40 with whole numbers', () => {
        expect(validateGoalStep(makeValues({ weeklyHours: '1' }))).toEqual({});
        expect(validateGoalStep(makeValues({ weeklyHours: '40' }))).toEqual({});
        expect(validateGoalStep(makeValues({ weeklyHours: '0' })).weeklyHours).toBeDefined();
        expect(validateGoalStep(makeValues({ weeklyHours: '41' })).weeklyHours).toBeDefined();
        expect(validateGoalStep(makeValues({ weeklyHours: '2.5' })).weeklyHours).toBeDefined();
        expect(validateGoalStep(makeValues({ weeklyHours: 'abc' })).weeklyHours).toBeDefined();
    });

    it('limits the background text', () => {
        expect(validateGoalStep(makeValues({ background: 'a'.repeat(1001) })).background).toBeDefined();
        expect(validateGoalStep(makeValues({ background: 'a'.repeat(1000) }))).toEqual({});
    });
});

describe('validateSkillsStep', () => {
    it('passes with no extra skills and default levels', () => {
        expect(validateSkillsStep(makeValues())).toEqual({});
    });

    it('flags an out-of-range declared level', () => {
        const values = makeValues({ skillLevels: { sql: 7 as never } });
        expect(validateSkillsStep(values).skillLevels).toBeDefined();
    });

    it('flags extra skills without a name, with a long name or with a bad level', () => {
        const values = makeValues({
            extraSkills: [
                { name: '  ', level: 2 },
                { name: 'x'.repeat(61), level: 1 },
                { name: 'Tableau', level: 9 as never },
            ],
        });
        const errors = validateSkillsStep(values);
        expect(errors['extraSkills.0.name']).toBeDefined();
        expect(errors['extraSkills.1.name']).toBeDefined();
        expect(errors['extraSkills.2.level']).toBeDefined();
    });
});

describe('validateTutorStep', () => {
    it('passes with the defaults', () => {
        expect(validateTutorStep(makeValues())).toEqual({});
    });

    it('limits free instructions to 500 characters', () => {
        const tooLong = makeValues({ tutorStyle: { ...INITIAL_VALUES.tutorStyle, freeInstructions: 'a'.repeat(501) } });
        expect(validateTutorStep(tooLong).freeInstructions).toBeDefined();
        const ok = makeValues({ tutorStyle: { ...INITIAL_VALUES.tutorStyle, freeInstructions: 'a'.repeat(500) } });
        expect(validateTutorStep(ok)).toEqual({});
    });

    it('rejects unknown tone and detail values', () => {
        const values = makeValues({
            tutorStyle: { ...INITIAL_VALUES.tutorStyle, tone: 'rude' as never, detailLevel: 'huge' as never },
        });
        const errors = validateTutorStep(values);
        expect(errors.tone).toBeDefined();
        expect(errors.detailLevel).toBeDefined();
    });
});

describe('validateStep', () => {
    it('dispatches by step index', () => {
        const empty = { ...INITIAL_VALUES };
        expect(Object.keys(validateStep(0, empty)).length).toBeGreaterThan(0);
        expect(validateStep(1, empty)).toEqual({});
        expect(validateStep(2, empty)).toEqual({});
        expect(validateStep(9, empty)).toEqual({});
    });
});

describe('buildOnboardingRequest', () => {
    it('trims text, converts hours and fills every role skill with a level (default 0)', () => {
        const values = makeValues({
            name: '  Alex  ',
            background: '  Studied statistics  ',
            weeklyHours: '10',
            skillLevels: { sql: 3 },
            extraSkills: [{ name: '  Tableau ', level: 2 }],
            tutorStyle: { ...INITIAL_VALUES.tutorStyle, freeInstructions: '  use cooking examples ' },
        });

        const request = buildOnboardingRequest(values, ['sql', 'pandas']);

        expect(request.name).toBe('Alex');
        expect(request.background).toBe('Studied statistics');
        expect(request.weeklyHours).toBe(10);
        expect(request.skillLevels).toEqual({ sql: 3, pandas: 0 });
        expect(request.extraSkills).toEqual([{ name: 'Tableau', level: 2 }]);
        expect(request.tutorStyle.freeInstructions).toBe('use cooking examples');
    });

    it('drops levels for skills that do not belong to the chosen role', () => {
        const values = makeValues({ skillLevels: { sql: 3, 'old-skill': 4 } });
        expect(buildOnboardingRequest(values, ['sql']).skillLevels).toEqual({ sql: 3 });
    });
});