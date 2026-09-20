import type {
    ExtraSkill,
    ProposedSkill,
    UnmappedSkill,
} from '../_lib/api/onboarding-types';
import { LIMITS, isSkillLevel } from './validation';

/**
 * Keeps only proposals that point to a skill of the chosen role, with a valid level
 * and at most one proposal per skill. The backend validates this too, but the UI must
 * never show a proposal for a skill that does not exist in the role.
 */
export function sanitizeProposals(
    proposals: readonly ProposedSkill[] | null | undefined,
    roleSkillSlugs: readonly string[],
): ProposedSkill[] {
    const known = new Set(roleSkillSlugs);
    const seen = new Set<string>();
    const result: ProposedSkill[] = [];

    for (const proposal of proposals ?? []) {
        if (!known.has(proposal.skillSlug)) continue;
        if (!isSkillLevel(proposal.proposedLevel)) continue;
        if (seen.has(proposal.skillSlug)) continue;
        seen.add(proposal.skillSlug);
        result.push(proposal);
    }

    return result;
}

/** Keeps suggestions for skills outside the role that have a name and a valid level. */
export function sanitizeUnmapped(unmapped: readonly UnmappedSkill[] | null | undefined): UnmappedSkill[] {
    const seen = new Set<string>();
    const result: UnmappedSkill[] = [];

    for (const skill of unmapped ?? []) {
        const name = skill.name?.trim();
        if (!name || !isSkillLevel(skill.proposedLevel)) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ ...skill, name });
    }

    return result;
}

export type AddExtraSkillStatus = 'added' | 'duplicate' | 'limit';

/** Adds a skill to "other skills" unless it is already there or the limit is reached. */
export function addExtraSkill(
    extraSkills: readonly ExtraSkill[],
    skill: ExtraSkill,
): { extraSkills: ExtraSkill[]; status: AddExtraSkillStatus } {
    const name = skill.name.trim().slice(0, LIMITS.extraSkillNameMax);
    const key = name.toLowerCase();

    if (extraSkills.some((existing) => existing.name.trim().toLowerCase() === key)) {
        return { extraSkills: [...extraSkills], status: 'duplicate' };
    }
    if (extraSkills.length >= LIMITS.extraSkillsMax) {
        return { extraSkills: [...extraSkills], status: 'limit' };
    }
    return { extraSkills: [...extraSkills, { name, level: skill.level }], status: 'added' };
}
