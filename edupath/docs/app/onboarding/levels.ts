import type { SkillLevel } from '../_lib/api/onboarding-types';

export interface LevelInfo {
    value: SkillLevel;
    label: string;
    description: string;
}

/** Self-assessment scale shown in the skills step (0 = no knowledge ... 4 = expert). */
export const SKILL_LEVELS: readonly LevelInfo[] = [
    { value: 0, label: 'No knowledge', description: "I haven't used this yet." },
    { value: 1, label: 'Beginner', description: 'I know the basic ideas and still need guidance.' },
    { value: 2, label: 'Basic', description: 'I can handle simple tasks on my own.' },
    { value: 3, label: 'Proficient', description: 'I use it regularly and handle most tasks.' },
    { value: 4, label: 'Expert', description: 'I could teach it and handle the hard cases.' },
];

export function getLevelInfo(level: SkillLevel): LevelInfo {
    return SKILL_LEVELS[level];
}
