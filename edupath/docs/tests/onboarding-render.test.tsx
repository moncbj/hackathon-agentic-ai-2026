import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StepSkills } from '@/components/onboarding/step-skills';
import { StepStyle } from '@/components/onboarding/step-style';
import { LevelSelector } from '@/components/onboarding/level-selector';
import { INITIAL_VALUES, type OnboardingFormValues } from '@/app/onboarding/validation';
import { MOCK_ROLE } from '@/app/_lib/api/onboarding';

const noop = () => { };

function values(overrides: Partial<OnboardingFormValues> = {}): OnboardingFormValues {
    return { ...INITIAL_VALUES, name: 'Alex', targetRoleSlug: MOCK_ROLE.slug, weeklyHours: '8', ...overrides };
}

describe('StepSkills (static render)', () => {
    it('shows every skill of the role grouped by category, each with a 0 to 4 control', () => {
        const html = renderToStaticMarkup(<StepSkills values={values()} errors={{}} role={MOCK_ROLE} onChange={noop} />);
        for (const skill of MOCK_ROLE.skills) expect(html).toContain(skill.name);
        for (const category of ['Data foundations', 'Statistics', 'Programming', 'Communication']) {
            expect(html).toContain(category);
        }
        // 5 radios per skill.
        expect((html.match(/type="radio"/g) ?? []).length).toBe(MOCK_ROLE.skills.length * 5);
        expect(html).toContain('Help me with my CV');
        expect(html).toContain('Add a skill');
    });

    it('defaults every skill to level 0 and reflects levels already chosen', () => {
        const html = renderToStaticMarkup(
            <StepSkills values={values({ skillLevels: { sql: 3 } })} errors={{}} role={MOCK_ROLE} onChange={noop} />,
        );
        // sql is at 3, the other 10 skills default to 0.
        expect((html.match(/checked=""/g) ?? []).length).toBe(MOCK_ROLE.skills.length);
        expect(html).toContain('Proficient');
    });

    it('shows inline errors for other skills and the limit message', () => {
        const extraSkills = Array.from({ length: 10 }, (_, index) => ({ name: index === 0 ? '' : `Skill ${index}`, level: 1 as const }));
        const html = renderToStaticMarkup(
            <StepSkills
                values={values({ extraSkills })}
                errors={{ 'extraSkills.0.name': 'Enter a skill name.' }}
                role={MOCK_ROLE}
                onChange={noop}
            />,
        );
        expect(html).toContain('Enter a skill name.');
        expect(html).toContain('10/10');
        expect(html).toContain('limit reached');
    });
});

describe('StepStyle (static render)', () => {
    it('shows language, tone, detail, analogies and free instructions with the 500 limit', () => {
        const html = renderToStaticMarkup(<StepStyle values={values()} errors={{}} onChange={noop} />);
        for (const text of ['Tutor language', 'Formal', 'Friendly', 'Motivating', 'Concise', 'Balanced', 'In depth', 'Explain with analogies']) {
            expect(html).toContain(text);
        }
        expect(html).toContain('0/500');
    });

    it('shows the free instructions error', () => {
        const html = renderToStaticMarkup(
            <StepStyle values={values()} errors={{ freeInstructions: 'Use at most 500 characters.' }} onChange={noop} />,
        );
        expect(html).toContain('Use at most 500 characters.');
    });
});

describe('LevelSelector (static render)', () => {
    it('is a labelled group with five options', () => {
        const html = renderToStaticMarkup(<LevelSelector skillName="SQL" value={2} onChange={noop} />);
        expect(html).toContain('Your level in SQL');
        expect((html.match(/type="radio"/g) ?? []).length).toBe(5);
    });
});
