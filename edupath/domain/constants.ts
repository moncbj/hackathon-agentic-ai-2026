// domain/constants.ts
// Single source of truth for all provisional constants from README §6 and SPEC-000

export const LEVEL_SCALE = { MIN: 0, MAX: 4 } as const;
export const PREREQ_MIN_LEVEL = 1;
export const PRIORITY_DEPENDENT_BONUS = 0.25;
export const VERIFY_MIN_WEIGHT = 4;
export const MINUTES_PER_LEVEL = 300;
export const WIP_LIMIT = 2;
export const JOURNEY_HORIZON_WEEKS = 4;
export const QUESTION_COUNT = 5;
export const PASS_THRESHOLD = 0.7;
export const PARTIAL_THRESHOLD = 0.4;
export const STRUGGLE_THRESHOLD = 2;
export const STRUGGLE_BOOST = 1.5;
export const SKIPPED_REPLAN_THRESHOLD = 2;

export const VERIFICATION_VALUES = ['self_reported', 'verified'] as const;
export type Verification = (typeof VERIFICATION_VALUES)[number];

export const STATUS_VALUES = ['locked', 'available', 'in_progress', 'acquired', 'struggling'] as const;
export type SkillStatus = (typeof STATUS_VALUES)[number];

export const RESOURCE_TYPES = ['course', 'video', 'article', 'docs', 'project', 'practice'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const TONE_VALUES = ['formal', 'cercano', 'motivador'] as const;
export type Tone = (typeof TONE_VALUES)[number];

export const DETAIL_LEVEL_VALUES = ['resumido', 'equilibrado', 'profundo'] as const;
export type DetailLevel = (typeof DETAIL_LEVEL_VALUES)[number];

export const ACTIVITY_TYPES = ['resource', 'practice', 'project'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_STATUS_VALUES = ['pending', 'done', 'skipped'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUS_VALUES)[number];

export const ASSESSMENT_KINDS = ['verification', 'progress'] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

export const ASSESSMENT_STATUS_VALUES = ['generated', 'graded'] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUS_VALUES)[number];

export const OBJECTIVE_STATUS_VALUES = ['active', 'done', 'dropped'] as const;
export type ObjectiveStatus = (typeof OBJECTIVE_STATUS_VALUES)[number];

export const JOURNEY_REASONS = ['initial', 'assessment', 'skipped_activities', 'profile_change'] as const;
export type JourneyReason = (typeof JOURNEY_REASONS)[number];
