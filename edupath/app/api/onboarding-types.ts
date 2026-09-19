// Provisional contract types for SPEC-001. Anything not explicit in the spec
// is logged in docs/contracts/frontend-requests.md for the backend to confirm.

export type SkillLevel = 0 | 1 | 2 | 3 | 4;

export interface RoleSkill {
    slug: string;
    name: string;
    description: string;
    category: string;
}

export interface Role {
    id: string;
    slug: string;
    name: string;
    description: string;
    skills: RoleSkill[];
}

export interface RolesResponse {
    roles: Role[];
}

export type Confidence = 'low' | 'medium' | 'high';

export interface ProposedSkill {
    skillSlug: string;
    proposedLevel: SkillLevel;
    rationale: string;
    confidence: Confidence;
}

export interface UnmappedSkill {
    name: string;
    proposedLevel: SkillLevel;
    rationale: string;
}

export interface ProfileExtractResponse {
    proposedSkills: ProposedSkill[];
    unmappedSkills: UnmappedSkill[];
    summary: string;
}

export type TutorTone = 'formal' | 'cercano' | 'motivador';
export type TutorDetail = 'resumido' | 'equilibrado' | 'profundo';

export interface TutorStyle {
    language: string;
    tone: TutorTone;
    detailLevel: TutorDetail;
    useAnalogies: boolean;
    freeInstructions: string;
}

export interface ExtraSkill {
    name: string;
    level: SkillLevel;
}

export interface OnboardingRequest {
    name: string;
    background: string;
    targetRoleSlug: string;
    weeklyHours: number;
    skillLevels: Record<string, SkillLevel>;
    extraSkills: ExtraSkill[];
    tutorStyle: TutorStyle;
}

export interface Learner {
    id: string;
    name: string;
}