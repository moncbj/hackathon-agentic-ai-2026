import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    MOCK_ROLE,
    extractProfile,
    fetchLearner,
    fetchRoles,
    isNoLearnerError,
    submitOnboarding,
} from '../app/_lib/api/onboarding';
import type { OnboardingRequest } from '../app/_lib/api/onboarding-types';

function stubBrowser(mockParam?: string) {
    vi.stubGlobal('window', { location: { search: mockParam ? `?mock=${mockParam}` : '' } });
}

async function withMocks<T>(param: string | undefined, run: () => Promise<T>): Promise<T> {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
    stubBrowser(param);
    vi.useFakeTimers();
    const promise = run();
    await vi.advanceTimersByTimeAsync(1000);
    return promise;
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
});

const sampleRequest: OnboardingRequest = {
    name: 'Alex',
    background: '',
    targetRoleSlug: MOCK_ROLE.slug,
    weeklyHours: 8,
    skillLevels: {},
    extraSkills: [],
    tutorStyle: { language: 'en', tone: 'cercano', detailLevel: 'equilibrado', useAnalogies: false, freeInstructions: '' },
};

describe('mock roles', () => {
    it('returns the mock role by default, empty for mock=empty and an error for mock=error', async () => {
        const ok = await withMocks(undefined, fetchRoles);
        expect(ok.data?.roles[0].slug).toBe(MOCK_ROLE.slug);
        expect(MOCK_ROLE.skills.length).toBeGreaterThanOrEqual(10);

        const empty = await withMocks('empty', fetchRoles);
        expect(empty.data?.roles).toEqual([]);

        const failed = await withMocks('error', fetchRoles);
        expect(failed.data).toBeNull();
        expect(failed.error?.status).toBe(500);
    });
});

describe('mock learner', () => {
    it('answers 404 by default and returns a learner for mock=has-learner', async () => {
        const none = await withMocks(undefined, fetchLearner);
        expect(none.data).toBeNull();
        expect(isNoLearnerError(none.error)).toBe(true);

        const some = await withMocks('has-learner', fetchLearner);
        expect(some.data?.id).toBeDefined();
        expect(isNoLearnerError(some.error)).toBe(false);
    });

    it('does not treat other errors as "no learner"', () => {
        expect(isNoLearnerError({ type: 'http', message: 'x', status: 500 })).toBe(false);
        expect(isNoLearnerError({ type: 'network', message: 'x' })).toBe(false);
        expect(isNoLearnerError(null)).toBe(false);
    });
});

describe('mock profile extraction', () => {
    it('proposes skills from keywords, only with slugs that exist in the mock role', async () => {
        const result = await withMocks(undefined, () => extractProfile('I write SQL daily, use Excel and Python. Built dashboards in Tableau.'));
        const slugs = result.data?.proposedSkills.map((p) => p.skillSlug) ?? [];
        expect(slugs).toEqual(expect.arrayContaining(['sql', 'spreadsheets', 'basic-python']));
        const roleSlugs = MOCK_ROLE.skills.map((s) => s.slug);
        expect(slugs.every((slug) => roleSlugs.includes(slug))).toBe(true);
        expect(result.data?.unmappedSkills.map((u) => u.name)).toContain('Tableau');
    });

    it('returns an empty proposal when nothing matches', async () => {
        const result = await withMocks(undefined, () => extractProfile('I like gardening'));
        expect(result.data?.proposedSkills).toEqual([]);
        expect(result.data?.summary).toMatch(/No clear evidence/);
    });

    it('returns an error for mock=extract-error', async () => {
        const result = await withMocks('extract-error', () => extractProfile('SQL'));
        expect(result.error?.status).toBe(502);
    });
});

describe('mock onboarding submit', () => {
    it('creates a learner by default, and simulates conflict and server errors', async () => {
        const ok = await withMocks(undefined, () => submitOnboarding(sampleRequest));
        expect(ok.data?.name).toBe('Alex');

        const conflict = await withMocks('conflict', () => submitOnboarding(sampleRequest));
        expect(conflict.error?.status).toBe(409);

        const failed = await withMocks('submit-error', () => submitOnboarding(sampleRequest));
        expect(failed.error?.status).toBe(500);
    });
});

describe('real requests (mocks disabled)', () => {
    it('POSTs JSON to the documented routes', async () => {
        vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'false');
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'x', name: 'Alex' }) });
        vi.stubGlobal('fetch', fetchMock);

        await submitOnboarding(sampleRequest);
        expect(fetchMock).toHaveBeenCalledWith(
            '/api/onboarding',
            expect.objectContaining({ method: 'POST', body: JSON.stringify(sampleRequest) }),
        );

        await extractProfile('some text');
        expect(fetchMock).toHaveBeenLastCalledWith(
            '/api/profile/extract',
            expect.objectContaining({ method: 'POST', body: JSON.stringify({ text: 'some text' }) }),
        );
    });
});