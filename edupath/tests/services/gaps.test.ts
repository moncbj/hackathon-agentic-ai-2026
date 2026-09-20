// tests/services/gaps.test.ts
// Unit tests for Gaps Service, caching, sanitization, and graceful AI fallback (SPEC-002)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getGapAnalysisAndExplanation,
  sanitizeAgentOutput,
  GapsServiceError,
} from '@/services/gaps';
import * as learnersRepo from '@/lib/db/repositories/learners';
import * as rolesRepo from '@/lib/db/repositories/roles';
import * as skillsRepo from '@/lib/db/repositories/skills';
import * as prereqsRepo from '@/lib/db/repositories/prerequisites';
import * as learnerSkillsRepo from '@/lib/db/repositories/learner-skills';
import * as tutorStylesRepo from '@/lib/db/repositories/tutor-styles';
import * as cacheRepo from '@/lib/db/repositories/gap-analyses';
import * as agentRunner from '@/agents/gap-analysis/run';

describe('services/gaps', () => {
  const mockLearnerId = 'learner-123';
  const mockRoleId = 'role-123';

  const mockLearner = {
    id: mockLearnerId,
    name: 'Ana García',
    target_role_id: mockRoleId,
    background: 'Estudiante',
    weekly_hours: 12,
    extra_skills: [],
    created_at: '2026-01-01T00:00:00Z',
  };

  const mockRole = {
    id: mockRoleId,
    slug: 'data-analyst-junior',
    name: 'Data Analyst (junior)',
    description: 'Role description',
    created_at: '2026-01-01T00:00:00Z',
  };

  const mockRoleSkills = [
    {
      id: 'skill-sql',
      slug: 'sql',
      name: 'SQL',
      description: 'SQL desc',
      category: 'Data',
      created_at: '2026-01-01T00:00:00Z',
      required_level: 3,
      weight: 5,
    },
    {
      id: 'skill-sheets',
      slug: 'spreadsheets',
      name: 'Spreadsheets',
      description: 'Sheets desc',
      category: 'Data',
      created_at: '2026-01-01T00:00:00Z',
      required_level: 3,
      weight: 4,
    },
  ];

  const mockTutorStyle = {
    learner_id: mockLearnerId,
    language: 'es',
    tone: 'cercano' as const,
    detail_level: 'equilibrado' as const,
    use_analogies: true,
    free_instructions: '',
    created_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Sanitizer: sanitizeAgentOutput', () => {
    it('removes invalid slugs and caps recommendedFocus at 3', () => {
      const allowedSlugs = ['sql', 'spreadsheets', 'python'];
      const rawOutput = {
        summary: 'Resumen válido',
        perSkill: [
          { skillSlug: 'sql', explanation: 'exp sql', whyItMatters: 'matters sql' },
          { skillSlug: 'sql', explanation: 'exp sql duplicate', whyItMatters: 'duplicate' },
          { skillSlug: 'invented-slug', explanation: 'invalid', whyItMatters: 'invalid' },
          { skillSlug: 'spreadsheets', explanation: 'exp sheets', whyItMatters: 'matters sheets' },
        ],
        recommendedFocus: ['sql', 'sql', 'invented-slug', 'spreadsheets', 'python', 'another-invented'],
      };

      const sanitized = sanitizeAgentOutput(rawOutput, allowedSlugs);

      expect(sanitized.perSkill).toHaveLength(2);
      expect(sanitized.perSkill[0].skillSlug).toBe('sql');
      expect(sanitized.perSkill[0].explanation).toBe('exp sql'); // Kept first occurrence
      expect(sanitized.perSkill[1].skillSlug).toBe('spreadsheets');

      // Deduplicated, removed invalid, capped at 3
      expect(sanitized.recommendedFocus).toEqual(['sql', 'spreadsheets', 'python']);
    });
  });

  describe('getGapAnalysisAndExplanation', () => {
    it('throws 404 NO_LEARNER when learner is missing', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(null);

      await expect(getGapAnalysisAndExplanation()).rejects.toThrow(GapsServiceError);
      await expect(getGapAnalysisAndExplanation()).rejects.toMatchObject({
        code: 'NO_LEARNER',
        status: 404,
      });
    });

    it('happy path on cache miss: runs agent once and saves result to cache', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue(mockRole);
      vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);
      vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue([]);
      vi.spyOn(tutorStylesRepo, 'getTutorStyle').mockResolvedValue(mockTutorStyle);

      // SQL has gap 2, Spreadsheets has level 3 (gap 0, needsVerification true)
      vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue([
        {
          learner_id: mockLearnerId,
          skill_id: 'skill-sql',
          level: 1,
          verification: 'self_reported',
          status: 'in_progress',
          progress: 0,
          consecutive_failures: 0,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
        {
          learner_id: mockLearnerId,
          skill_id: 'skill-sheets',
          level: 3,
          verification: 'self_reported',
          status: 'acquired',
          progress: 0,
          consecutive_failures: 0,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ]);

      // Cache miss
      vi.spyOn(cacheRepo, 'getGapAnalysisCache').mockResolvedValue(null);
      const saveSpy = vi.spyOn(cacheRepo, 'saveGapAnalysisCache').mockResolvedValue({
        id: 'cache-1',
        learnerId: mockLearnerId,
        inputHash: 'hash-1',
        result: { summary: '', perSkill: [], recommendedFocus: [] },
        createdAt: '2026-01-01',
      });

      const agentSpy = vi.spyOn(agentRunner, 'runGapAnalysisAgent').mockResolvedValue({
        summary: 'Buen progreso general.',
        perSkill: [
          { skillSlug: 'sql', explanation: 'Falta SQL.', whyItMatters: 'Esencial.' },
        ],
        recommendedFocus: ['sql'],
      });

      const response = await getGapAnalysisAndExplanation();

      expect(response.summary).toEqual({
        totalSkills: 2,
        acquired: 1,
        withGap: 1,
        needsVerification: 1,
      });
      expect(response.topPriorities).toHaveLength(1);
      expect(response.topPriorities[0].skillSlug).toBe('sql');
      expect(response.unverified).toHaveLength(1);
      expect(response.unverified[0].skillSlug).toBe('spreadsheets');

      expect(agentSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(response.agentExplanation).not.toBeNull();
      expect(response.agentExplanation?.summary).toBe('Buen progreso general.');
    });

    it('happy path on cache hit: returns cached explanation without calling agent', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue(mockRole);
      vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);
      vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue([]);
      vi.spyOn(tutorStylesRepo, 'getTutorStyle').mockResolvedValue(mockTutorStyle);
      vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue([]);

      // Cache hit
      vi.spyOn(cacheRepo, 'getGapAnalysisCache').mockResolvedValue({
        id: 'cache-1',
        learnerId: mockLearnerId,
        inputHash: 'some-hash',
        result: {
          summary: 'Explicación en caché.',
          perSkill: [
            { skillSlug: 'sql', explanation: 'Detalle sql', whyItMatters: 'Importante sql' },
          ],
          recommendedFocus: ['sql'],
        },
        createdAt: '2026-01-01',
      });

      const agentSpy = vi.spyOn(agentRunner, 'runGapAnalysisAgent');

      const response = await getGapAnalysisAndExplanation();

      expect(agentSpy).not.toHaveBeenCalled();
      expect(response.agentExplanation?.summary).toBe('Explicación en caché.');
    });

    it('falls back gracefully to deterministic response when agent throws an error', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue(mockRole);
      vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);
      vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue([]);
      vi.spyOn(tutorStylesRepo, 'getTutorStyle').mockResolvedValue(mockTutorStyle);
      vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue([]);
      vi.spyOn(cacheRepo, 'getGapAnalysisCache').mockResolvedValue(null);

      // Mock agent failure
      vi.spyOn(agentRunner, 'runGapAnalysisAgent').mockRejectedValue(new Error('Gemini API timeout'));

      const response = await getGapAnalysisAndExplanation();

      // Deterministic data is intact!
      expect(response.summary.totalSkills).toBe(2);
      expect(response.gaps).toHaveLength(2);
      expect(response.topPriorities.length).toBeGreaterThan(0);
      // Explanation is null
      expect(response.agentExplanation).toBeNull();
    });

    it('skips AI call entirely when there are zero gaps and zero skills to verify', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue(mockRole);
      vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);
      vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue([]);
      vi.spyOn(tutorStylesRepo, 'getTutorStyle').mockResolvedValue(mockTutorStyle);

      // Both skills acquired and verified -> gap 0, needsVerification false
      vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue([
        {
          learner_id: mockLearnerId,
          skill_id: 'skill-sql',
          level: 3,
          verification: 'verified',
          status: 'acquired',
          progress: 0,
          consecutive_failures: 0,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
        {
          learner_id: mockLearnerId,
          skill_id: 'skill-sheets',
          level: 3,
          verification: 'verified',
          status: 'acquired',
          progress: 0,
          consecutive_failures: 0,
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ]);

      const agentSpy = vi.spyOn(agentRunner, 'runGapAnalysisAgent');
      const cacheSpy = vi.spyOn(cacheRepo, 'getGapAnalysisCache');

      const response = await getGapAnalysisAndExplanation();

      expect(response.summary.acquired).toBe(2);
      expect(response.summary.withGap).toBe(0);
      expect(response.summary.needsVerification).toBe(0);
      expect(response.agentExplanation).toBeNull();
      expect(agentSpy).not.toHaveBeenCalled();
      expect(cacheSpy).not.toHaveBeenCalled();
    });

    it('treats corrupted cache record as miss and regenerates explanation', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue(mockRole);
      vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);
      vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue([]);
      vi.spyOn(tutorStylesRepo, 'getTutorStyle').mockResolvedValue(mockTutorStyle);
      vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue([]);

      // Cache record with invalid schema
      vi.spyOn(cacheRepo, 'getGapAnalysisCache').mockResolvedValue({
        id: 'cache-corrupt',
        learnerId: mockLearnerId,
        inputHash: 'some-hash',
        result: { invalid: 'schema' } as unknown as cacheRepo.GapAnalysisCacheRecord['result'],
        createdAt: '2026-01-01',
      });

      const agentSpy = vi.spyOn(agentRunner, 'runGapAnalysisAgent').mockResolvedValue({
        summary: 'Nueva explicación tras corrupto.',
        perSkill: [],
        recommendedFocus: [],
      });
      vi.spyOn(cacheRepo, 'saveGapAnalysisCache').mockResolvedValue({
        id: 'cache-saved-1',
        learnerId: mockLearnerId,
        inputHash: 'hash-1',
        result: { summary: '', perSkill: [], recommendedFocus: [] },
        createdAt: '2026-01-01',
      });

      const response = await getGapAnalysisAndExplanation();

      expect(agentSpy).toHaveBeenCalledTimes(1);
      expect(response.agentExplanation?.summary).toBe('Nueva explicación tras corrupto.');
    });

    it('is non-fatal when cache read throws an unexpected DB error', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue(mockRole);
      vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);
      vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue([]);
      vi.spyOn(tutorStylesRepo, 'getTutorStyle').mockResolvedValue(mockTutorStyle);
      vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue([]);

      vi.spyOn(cacheRepo, 'getGapAnalysisCache').mockRejectedValue(new Error('DB read connection dropped'));
      const agentSpy = vi.spyOn(agentRunner, 'runGapAnalysisAgent').mockResolvedValue({
        summary: 'Explicación exitosa.',
        perSkill: [],
        recommendedFocus: [],
      });
      vi.spyOn(cacheRepo, 'saveGapAnalysisCache').mockResolvedValue({
        id: 'cache-saved-2',
        learnerId: mockLearnerId,
        inputHash: 'hash-2',
        result: { summary: '', perSkill: [], recommendedFocus: [] },
        createdAt: '2026-01-01',
      });

      const response = await getGapAnalysisAndExplanation();

      expect(agentSpy).toHaveBeenCalledTimes(1);
      expect(response.agentExplanation?.summary).toBe('Explicación exitosa.');
    });

    it('is non-fatal when cache write throws an unexpected DB error', async () => {
      vi.spyOn(learnersRepo, 'getActiveLearner').mockResolvedValue(mockLearner);
      vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue(mockRole);
      vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);
      vi.spyOn(prereqsRepo, 'getPrerequisitesForSkills').mockResolvedValue([]);
      vi.spyOn(tutorStylesRepo, 'getTutorStyle').mockResolvedValue(mockTutorStyle);
      vi.spyOn(learnerSkillsRepo, 'getLearnerSkills').mockResolvedValue([]);
      vi.spyOn(cacheRepo, 'getGapAnalysisCache').mockResolvedValue(null);

      vi.spyOn(agentRunner, 'runGapAnalysisAgent').mockResolvedValue({
        summary: 'Explicación generada.',
        perSkill: [],
        recommendedFocus: [],
      });
      vi.spyOn(cacheRepo, 'saveGapAnalysisCache').mockRejectedValue(new Error('DB write failed'));

      const response = await getGapAnalysisAndExplanation();

      expect(response.agentExplanation?.summary).toBe('Explicación generada.');
    });
  });
});
