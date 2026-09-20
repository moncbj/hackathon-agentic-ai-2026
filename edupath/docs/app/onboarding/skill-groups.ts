import type { RoleSkill } from '../_lib/api/onboarding-types';

export interface SkillGroup {
    category: string;
    skills: RoleSkill[];
}

/** Groups skills by category, keeping the order in which categories first appear. */
export function groupSkillsByCategory(skills: readonly RoleSkill[]): SkillGroup[] {
    const groups = new Map<string, RoleSkill[]>();
    for (const skill of skills) {
        const category = skill.category.trim() || 'Other';
        const list = groups.get(category);
        if (list) list.push(skill);
        else groups.set(category, [skill]);
    }
    return Array.from(groups, ([category, list]) => ({ category, skills: list }));
}
