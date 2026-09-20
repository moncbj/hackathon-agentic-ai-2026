// domain/journey.ts
// Pure, deterministic journey skeleton builder (SPEC-003 §3.1)

import {
  JOURNEY_HORIZON_WEEKS,
  MINUTES_PER_LEVEL,
  STRUGGLE_BOOST,
  WIP_LIMIT,
  ActivityType,
  SkillStatus,
} from './constants';

export interface JourneyCandidateGap {
  skillId: string;
  skillSlug: string;
  name: string;
  level: number;
  requiredLevel: number;
  gap: number;
  priority: number;
  depth?: number;
}

export interface JourneyLearnerSkill {
  skillId: string;
  level: number;
  status: SkillStatus;
  verification?: 'self_reported' | 'verified';
}

export interface JourneyPrerequisite {
  skillId: string;            // dependent skill
  prerequisiteSkillId: string; // prerequisite skill
}

export interface JourneyResource {
  id: string;
  skill_id?: string;
  skillId?: string;
  skill_slug?: string;
  skillSlug?: string;
  title: string;
  url: string;
  type: string;
  level_min: number;
  level_max: number;
  language: string;
  verified: boolean;
}

export interface PreviousJourneyActivity {
  skillId: string;
  skillSlug?: string;
  type: string;
  resourceId?: string;
}

export interface PreviousJourney {
  id: string;
  activities: PreviousJourneyActivity[];
}

export interface JourneySkeletonConfig {
  minutesPerLevel?: number;
  wipLimit?: number;
  horizonWeeks?: number;
  struggleBoost?: number;
  learnerLanguage?: string;
}

export interface BuildJourneySkeletonParams {
  gaps: JourneyCandidateGap[];
  learnerSkills: JourneyLearnerSkill[];
  prerequisites: JourneyPrerequisite[];
  weeklyHours: number;
  resources: JourneyResource[];
  previousJourneys?: PreviousJourney[];
  config?: JourneySkeletonConfig;
}

export interface ActivitySlot {
  slotId: string;
  skillId: string;
  skillSlug: string;
  week: number;
  type: ActivityType;
  minutes: number;
  resource?: {
    id: string;
    title: string;
    url: string;
    type: string;
  };
  noResource?: boolean;
  reinforcement?: boolean;
}

export interface ScheduledSkillPortion {
  skillId: string;
  skillSlug: string;
  name: string;
  currentLevel: number;
  targetLevel: number;
  week: number;
  allocatedMinutes: number;
  slots: ActivitySlot[];
}

export interface ScheduledWeek {
  weekNumber: number;
  totalMinutes: number;
  distinctSkills: string[];
  slots: ActivitySlot[];
}

export interface BacklogItem {
  skillId: string;
  skillSlug: string;
  name: string;
  remainingMinutes: number;
}

export interface ScheduledSkillSummary {
  skillId: string;
  skillSlug: string;
  name: string;
  currentLevel: number;
  targetLevel: number;
  reinforcement: boolean;
  totalScheduledMinutes: number;
  slots: ActivitySlot[];
}

export interface JourneySkeleton {
  weeks: ScheduledWeek[];
  scheduledSkills: ScheduledSkillSummary[];
  backlog: BacklogItem[];
  studyOrder: string[]; // array of skillSlugs in study order
}

interface InternalCandidate {
  skillId: string;
  skillSlug: string;
  name: string;
  currentLevel: number;
  targetLevel: number;
  gap: number;
  priority: number;
  effectivePriority: number;
  depth: number;
  totalEffort: number;
  remainingEffort: number;
  reinforcement: boolean;
  status: SkillStatus;
  prerequisiteIds: Set<string>; // direct prerequisites that are ALSO candidates with gap
}

/**
 * Builds a deterministic weekly journey skeleton from gaps, prerequisites, and resource catalog.
 * SPEC-003 §3.1
 */
export function buildJourneySkeleton(params: BuildJourneySkeletonParams): JourneySkeleton {
  const {
    gaps,
    learnerSkills,
    prerequisites,
    weeklyHours,
    resources,
    previousJourneys = [],
    config = {},
  } = params;

  const minutesPerLevel = config.minutesPerLevel ?? MINUTES_PER_LEVEL;
  const wipLimit = config.wipLimit ?? WIP_LIMIT;
  const horizonWeeks = config.horizonWeeks ?? JOURNEY_HORIZON_WEEKS;
  const struggleBoost = config.struggleBoost ?? STRUGGLE_BOOST;
  const learnerLanguage = config.learnerLanguage ?? 'es';

  const weeklyBudget = weeklyHours * 60;

  // 1. Build learner status lookup
  const learnerSkillMap = new Map<string, JourneyLearnerSkill>();
  for (const ls of learnerSkills) {
    learnerSkillMap.set(ls.skillId, ls);
  }

  // 2. Filter candidates: gap > 0 and status !== 'acquired'
  const candidateGaps = gaps.filter((g) => {
    if (g.gap <= 0) return false;
    const ls = learnerSkillMap.get(g.skillId);
    if (ls && ls.status === 'acquired') return false;
    return true;
  });

  const candidateIdSet = new Set<string>(candidateGaps.map((c) => c.skillId));

  // 3. Map prerequisites among candidate skills
  const candidatePrereqMap = new Map<string, Set<string>>();
  for (const cid of candidateIdSet) {
    candidatePrereqMap.set(cid, new Set());
  }

  for (const p of prerequisites) {
    // Only care if both dependent and prerequisite are active candidates with gap
    if (candidateIdSet.has(p.skillId) && candidateIdSet.has(p.prerequisiteSkillId)) {
      candidatePrereqMap.get(p.skillId)?.add(p.prerequisiteSkillId);
    }
  }

  // 4. Create internal candidate items with effective priority and effort
  const candidates: InternalCandidate[] = candidateGaps.map((g) => {
    const ls = learnerSkillMap.get(g.skillId);
    const status = ls?.status ?? 'available';
    const isStruggling = status === 'struggling';
    const effectivePriority = isStruggling ? g.priority * struggleBoost : g.priority;
    const totalEffort = g.gap * minutesPerLevel;

    return {
      skillId: g.skillId,
      skillSlug: g.skillSlug,
      name: g.name,
      currentLevel: g.level,
      targetLevel: g.requiredLevel,
      gap: g.gap,
      priority: g.priority,
      effectivePriority,
      depth: g.depth ?? 0,
      totalEffort,
      remainingEffort: totalEffort,
      reinforcement: isStruggling,
      status,
      prerequisiteIds: candidatePrereqMap.get(g.skillId) ?? new Set(),
    };
  });

  // Track which candidates are completely scheduled
  const completelyScheduledIds = new Set<string>();
  const scheduledOrder: string[] = []; // track the order in which skills are picked for study

  // Helper to test if all candidate prerequisites of candidate are completely scheduled
  const arePrerequisitesMet = (c: InternalCandidate): boolean => {
    for (const prereqId of c.prerequisiteIds) {
      if (!completelyScheduledIds.has(prereqId)) {
        return false;
      }
    }
    return true;
  };

  // Sort comparator for eligible candidates: effectivePriority DESC, depth ASC, name ASC, skillSlug ASC
  const compareEligible = (a: InternalCandidate, b: InternalCandidate): number => {
    if (b.effectivePriority !== a.effectivePriority) {
      return b.effectivePriority - a.effectivePriority;
    }
    if (a.depth !== b.depth) {
      return a.depth - b.depth;
    }
    const nameCmp = a.name.localeCompare(b.name);
    if (nameCmp !== 0) return nameCmp;
    return a.skillSlug.localeCompare(b.skillSlug);
  };

  // Helper to record study order when a skill is first touched
  const recordStudyOrder = (skillSlug: string) => {
    if (!scheduledOrder.includes(skillSlug)) {
      scheduledOrder.push(skillSlug);
    }
  };

  // Allocation per week: Array of { weekNumber, portions: Array<{ candidate, allocatedMinutes }> }
  interface WeekAllocation {
    weekNumber: number;
    portions: Array<{
      candidate: InternalCandidate;
      allocatedMinutes: number;
    }>;
  }

  const weeksAllocations: WeekAllocation[] = [];

  // Traverse weeks 1 .. horizonWeeks
  for (let weekNum = 1; weekNum <= horizonWeeks; weekNum++) {
    let weekRemainingMinutes = weeklyBudget;
    const weekPortions: Array<{ candidate: InternalCandidate; allocatedMinutes: number }> = [];
    const weekSkillIds = new Set<string>();

    while (weekRemainingMinutes > 0) {
      // Find candidate skills that have remaining effort and whose prerequisites are met
      const eligible = candidates.filter(
        (c) => c.remainingEffort > 0 && arePrerequisitesMet(c)
      );

      if (eligible.length === 0) {
        break; // No eligible candidates ready to be scheduled
      }

      // Filter eligible by WIP limit for this week:
      // Can pick skill if it's already in this week OR if weekSkillIds.size < wipLimit
      const canPick = eligible.filter(
        (c) => weekSkillIds.has(c.skillId) || weekSkillIds.size < wipLimit
      );

      if (canPick.length === 0) {
        break; // Cannot add any more distinct skills to this week
      }

      // Prioritize skills already active in this week first (to keep continuity),
      // or pick highest priority eligible
      const activeInWeek = canPick.filter((c) => weekSkillIds.has(c.skillId));
      let selected: InternalCandidate;

      if (activeInWeek.length > 0) {
        activeInWeek.sort(compareEligible);
        selected = activeInWeek[0];
      } else {
        canPick.sort(compareEligible);
        selected = canPick[0];
      }

      recordStudyOrder(selected.skillSlug);
      weekSkillIds.add(selected.skillId);

      // Allocate as much as possible up to remaining budget and remaining effort
      const allocate = Math.min(selected.remainingEffort, weekRemainingMinutes);
      selected.remainingEffort -= allocate;
      weekRemainingMinutes -= allocate;

      // Add to portion or update existing portion in this week
      const existingPortion = weekPortions.find((p) => p.candidate.skillId === selected.skillId);
      if (existingPortion) {
        existingPortion.allocatedMinutes += allocate;
      } else {
        weekPortions.push({ candidate: selected, allocatedMinutes: allocate });
      }

      // If skill is fully scheduled, mark it so dependent skills become eligible
      if (selected.remainingEffort === 0) {
        completelyScheduledIds.add(selected.skillId);
      }
    }

    if (weekPortions.length > 0) {
      weeksAllocations.push({
        weekNumber: weekNum,
        portions: weekPortions,
      });
    }
  }

  // 5. Backlog items: any candidate with remainingEffort > 0
  const backlog: BacklogItem[] = candidates
    .filter((c) => c.remainingEffort > 0)
    .map((c) => ({
      skillId: c.skillId,
      skillSlug: c.skillSlug,
      name: c.name,
      remainingMinutes: c.remainingEffort,
    }));

  // 6. Split portions into ActivitySlots (15-min multiples, resources, practices, projects)
  // For each candidate that was scheduled, track total portions to know which is the first and which is the last portion.
  const candidatePortionsMap = new Map<
    string,
    Array<{ weekNumber: number; allocatedMinutes: number }>
  >();

  for (const wa of weeksAllocations) {
    for (const p of wa.portions) {
      const list = candidatePortionsMap.get(p.candidate.skillId) || [];
      list.push({ weekNumber: wa.weekNumber, allocatedMinutes: p.allocatedMinutes });
      candidatePortionsMap.set(p.candidate.skillId, list);
    }
  }

  // Build resource helper
  // Previously used resources lookup
  const usedResourceIds = new Set<string>();
  const usedResourceTypes = new Set<string>();
  for (const pj of previousJourneys) {
    for (const act of pj.activities) {
      if (act.resourceId) usedResourceIds.add(act.resourceId);
      if (act.type) usedResourceTypes.add(act.type);
    }
  }

  const findBestResource = (
    skillId: string,
    skillSlug: string,
    currentLevel: number,
    reinforcement: boolean
  ): JourneyResource | null => {
    // Filter matching resources
    const matching = resources.filter((r) => {
      const idMatches = r.skill_id === skillId || r.skillId === skillId;
      const slugMatches = r.skill_slug === skillSlug || r.skillSlug === skillSlug;
      if (!idMatches && !slugMatches) return false;
      return r.level_min <= currentLevel && currentLevel <= r.level_max;
    });

    if (matching.length === 0) return null;

    // Filter out previously used if reinforcement
    let candidatesList = matching;
    if (reinforcement && matching.some((r) => !usedResourceIds.has(r.id))) {
      candidatesList = matching.filter((r) => !usedResourceIds.has(r.id));
    }

    // Sort by scoring:
    // 1. If reinforcement, prefer type NOT used before
    // 2. verified === true
    // 3. language === learnerLanguage
    return [...candidatesList].sort((a, b) => {
      if (reinforcement) {
        const aTypeNew = !usedResourceTypes.has(a.type);
        const bTypeNew = !usedResourceTypes.has(b.type);
        if (aTypeNew !== bTypeNew) return aTypeNew ? -1 : 1;
      }
      if (a.verified !== b.verified) {
        return a.verified ? -1 : 1;
      }
      const aLang = a.language === learnerLanguage;
      const bLang = b.language === learnerLanguage;
      if (aLang !== bLang) {
        return aLang ? -1 : 1;
      }
      return a.title.localeCompare(b.title);
    })[0] ?? null;
  };

  const finalWeeks: ScheduledWeek[] = [];
  const scheduledSkillsMap = new Map<string, ScheduledSkillSummary>();

  for (const c of candidates) {
    const portions = candidatePortionsMap.get(c.skillId);
    if (!portions || portions.length === 0) continue;

    scheduledSkillsMap.set(c.skillId, {
      skillId: c.skillId,
      skillSlug: c.skillSlug,
      name: c.name,
      currentLevel: c.currentLevel,
      targetLevel: c.targetLevel,
      reinforcement: c.reinforcement,
      totalScheduledMinutes: portions.reduce((sum, p) => sum + p.allocatedMinutes, 0),
      slots: [],
    });
  }

  // Iterate through weekly allocations and create slots
  for (const wa of weeksAllocations) {
    const weekSlots: ActivitySlot[] = [];
    const distinctSkills = wa.portions.map((p) => p.candidate.skillSlug);

    for (const portion of wa.portions) {
      const c = portion.candidate;
      const allPortions = candidatePortionsMap.get(c.skillId) || [];
      const isFirstPortion = allPortions[0]?.weekNumber === wa.weekNumber;
      const isLastPortion = allPortions[allPortions.length - 1]?.weekNumber === wa.weekNumber;
      const includeProject = c.gap >= 2 && isLastPortion;

      const portionMinutes = portion.allocatedMinutes;
      const slotDefinitions: Array<{ type: ActivityType; minutes: number }> = [];

      // Divide portionMinutes (always a multiple of 15) into activities
      // Rules:
      // Every skill needs at least one resource and one practice slot.
      // If gap >= 2, project slot in final portion.
      if (allPortions.length === 1) {
        // Skill completed in a single week
        if (includeProject && portionMinutes >= 75) {
          // resource, practice, project
          // e.g. for 300 min: 60 resource, 120 practice, 120 project
          const resourceMin = Math.max(15, Math.floor((portionMinutes * 0.25) / 15) * 15);
          const practiceMin = Math.max(15, Math.floor((portionMinutes * 0.35) / 15) * 15);
          const projectMin = portionMinutes - resourceMin - practiceMin;
          slotDefinitions.push({ type: 'resource', minutes: resourceMin });
          slotDefinitions.push({ type: 'practice', minutes: practiceMin });
          slotDefinitions.push({ type: 'project', minutes: projectMin });
        } else if (portionMinutes >= 30) {
          // resource and practice
          // e.g. for 300 min: 120 resource, 180 practice
          const resourceMin = Math.max(15, Math.floor((portionMinutes * 0.4) / 15) * 15);
          const practiceMin = portionMinutes - resourceMin;
          slotDefinitions.push({ type: 'resource', minutes: resourceMin });
          slotDefinitions.push({ type: 'practice', minutes: practiceMin });
        } else {
          slotDefinitions.push({ type: 'resource', minutes: portionMinutes });
        }
      } else {
        // Multi-week skill
        if (isFirstPortion) {
          // First week: Resource + Practice
          const resourceMin = Math.max(15, Math.floor((portionMinutes * 0.4) / 15) * 15);
          const practiceMin = portionMinutes - resourceMin;
          slotDefinitions.push({ type: 'resource', minutes: resourceMin });
          slotDefinitions.push({ type: 'practice', minutes: practiceMin });
        } else if (isLastPortion) {
          // Last week: Practice + Project (if gap >= 2)
          if (includeProject && portionMinutes >= 45) {
            const practiceMin = Math.max(15, Math.floor((portionMinutes * 0.4) / 15) * 15);
            const projectMin = portionMinutes - practiceMin;
            slotDefinitions.push({ type: 'practice', minutes: practiceMin });
            slotDefinitions.push({ type: 'project', minutes: projectMin });
          } else {
            slotDefinitions.push({ type: 'practice', minutes: portionMinutes });
          }
        } else {
          // Middle week: pure Practice
          slotDefinitions.push({ type: 'practice', minutes: portionMinutes });
        }
      }

      // Convert slot definitions into ActivitySlot instances
      let slotIdxInPortion = 1;
      for (const def of slotDefinitions) {
        let type = def.type;
        let selectedResource: JourneyResource | null = null;
        let noResource = false;

        if (type === 'resource') {
          selectedResource = findBestResource(
            c.skillId,
            c.skillSlug,
            c.currentLevel,
            c.reinforcement
          );

          if (!selectedResource) {
            // Rule 7: If no suitable resource, slot becomes practice and marked noResource = true
            type = 'practice';
            noResource = true;
          }
        }

        const slotId = `slot-w${wa.weekNumber}-${c.skillSlug}-${type}-${slotIdxInPortion}`;
        slotIdxInPortion++;

        const slot: ActivitySlot = {
          slotId,
          skillId: c.skillId,
          skillSlug: c.skillSlug,
          week: wa.weekNumber,
          type,
          minutes: def.minutes,
          ...(selectedResource
            ? {
                resource: {
                  id: selectedResource.id,
                  title: selectedResource.title,
                  url: selectedResource.url,
                  type: selectedResource.type,
                },
              }
            : {}),
          ...(noResource ? { noResource: true } : {}),
          ...(c.reinforcement ? { reinforcement: true } : {}),
        };

        weekSlots.push(slot);
        scheduledSkillsMap.get(c.skillId)?.slots.push(slot);
      }
    }

    finalWeeks.push({
      weekNumber: wa.weekNumber,
      totalMinutes: weekSlots.reduce((sum, s) => sum + s.minutes, 0),
      distinctSkills,
      slots: weekSlots,
    });
  }

  return {
    weeks: finalWeeks,
    scheduledSkills: Array.from(scheduledSkillsMap.values()),
    backlog,
    studyOrder: scheduledOrder,
  };
}
