import type {
    ExtraSkill,
    OnboardingRequest,
    SkillLevel,
    TutorDetail,
    TutorStyle,
    TutorTone,
} from '../_lib/api/onboarding-types';

export const LIMITS = {
    nameMax: 80,
    backgroundMax: 1000,
    hoursMin: 1,
    hoursMax: 40,
    extraSkillNameMax: 60,
    extraSkillsMax: 10,
    freeInstructionsMax: 500,
} as const;

export const TUTOR_TONES: readonly TutorTone[] = ['formal', 'cercano', 'motivador'];
export const TUTOR_DETAIL_LEVELS: readonly TutorDetail[] = ['resumido', 'equilibrado', 'profundo'];

export interface OnboardingFormValues {
    name: string;
    background: string;
    targetRoleSlug: string;
    /** Kept as a string so the input can be empty while typing. */
    weeklyHours: string;
    skillLevels: Record<string, SkillLevel>;
    extraSkills: ExtraSkill[];
    tutorStyle: TutorStyle;
}

export type FormErrors = Record<string, string>;

export const INITIAL_VALUES: OnboardingFormValues = {
    name: '',
    background: '',
    targetRoleSlug: '',
    weeklyHours: '',
    skillLevels: {},
    extraSkills: [],
    tutorStyle: {
        language: 'en',
        tone: 'cercano',
        detailLevel: 'equilibrado',
        useAnalogies: false,
        freeInstructions: '',
    },
};

export function isSkillLevel(value: unknown): value is SkillLevel {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4;
}

export function validateGoalStep(values: OnboardingFormValues): FormErrors {
    const errors: FormErrors = {};

    const name = values.name.trim();
    if (!name) errors.name = 'Enter your name.';
    else if (name.length > LIMITS.nameMax) errors.name = `Use at most ${LIMITS.nameMax} characters.`;

    if (values.background.length > LIMITS.backgroundMax) {
        errors.background = `Use at most ${LIMITS.backgroundMax} characters.`;
    }

    if (!values.targetRoleSlug) errors.targetRoleSlug = 'Choose a target role.';

    const hours = values.weeklyHours.trim();
    if (!hours) {
        errors.weeklyHours = 'Enter how many hours per week you can study.';
    } else if (!/^\d+$/.test(hours) || Number(hours) < LIMITS.hoursMin || Number(hours) > LIMITS.hoursMax) {
        errors.weeklyHours = `Enter a whole number from ${LIMITS.hoursMin} to ${LIMITS.hoursMax}.`;
    }

    return errors;
}

export function validateSkillsStep(values: OnboardingFormValues): FormErrors {
    const errors: FormErrors = {};

    if (!Object.values(values.skillLevels).every(isSkillLevel)) {
        errors.skillLevels = 'Every skill needs a level from 0 to 4.';
    }

    if (values.extraSkills.length > LIMITS.extraSkillsMax) {
        errors.extraSkills = `Add at most ${LIMITS.extraSkillsMax} other skills.`;
    }

    values.extraSkills.forEach((skill, index) => {
        const name = skill.name.trim();
        if (!name) errors[`extraSkills.${index}.name`] = 'Enter a skill name.';
        else if (name.length > LIMITS.extraSkillNameMax) {
            errors[`extraSkills.${index}.name`] = `Use at most ${LIMITS.extraSkillNameMax} characters.`;
        }
        if (!isSkillLevel(skill.level)) errors[`extraSkills.${index}.level`] = 'Choose a level from 0 to 4.';
    });

    return errors;
}

export function validateTutorStep(values: OnboardingFormValues): FormErrors {
    const errors: FormErrors = {};
    const { language, tone, detailLevel, freeInstructions } = values.tutorStyle;

    if (!language.trim()) errors.language = 'Choose a language.';
    if (!TUTOR_TONES.includes(tone)) errors.tone = 'Choose a tone.';
    if (!TUTOR_DETAIL_LEVELS.includes(detailLevel)) errors.detailLevel = 'Choose a level of detail.';
    if (freeInstructions.length > LIMITS.freeInstructionsMax) {
        errors.freeInstructions = `Use at most ${LIMITS.freeInstructionsMax} characters.`;
    }

    return errors;
}

/** Validates the wizard step at `stepIndex` (0 = goal, 1 = skills, 2 = tutor style). */
export function validateStep(stepIndex: number, values: OnboardingFormValues): FormErrors {
    if (stepIndex === 0) return validateGoalStep(values);
    if (stepIndex === 1) return validateSkillsStep(values);
    if (stepIndex === 2) return validateTutorStep(values);
    return {};
}

export function buildOnboardingRequest(
    values: OnboardingFormValues,
    roleSkillSlugs: string[],
): OnboardingRequest {
    const skillLevels: Record<string, SkillLevel> = {};
    for (const slug of roleSkillSlugs) {
        skillLevels[slug] = values.skillLevels[slug] ?? 0;
    }

    return {
        name: values.name.trim(),
        background: values.background.trim(),
        targetRoleSlug: values.targetRoleSlug,
        weeklyHours: Number(values.weeklyHours),
        skillLevels,
        extraSkills: values.extraSkills.map((skill) => ({ name: skill.name.trim(), level: skill.level })),
        tutorStyle: {
            ...values.tutorStyle,
            freeInstructions: values.tutorStyle.freeInstructions.trim(),
        },
    };
}