import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchLearner, isNoLearnerError } from '../app/_lib/api/onboarding';

async function withMocks<T>(param: string | undefined, run: () => Promise<T>): Promise<T> {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
    vi.stubGlobal('window', { location: { search: param ? `?mock=${param}` : '' } });
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

describe('fetchLearner mock states used by the redirects', () => {
    it('answers 404 by default so / and /dashboard send people to onboarding', async () => {
        const result = await withMocks(undefined, fetchLearner);
        expect(isNoLearnerError(result.error)).toBe(true);
    });

    it('returns a learner for mock=has-learner', async () => {
        const result = await withMocks('has-learner', fetchLearner);
        expect(result.data?.name).toBe('Alex');
    });

    it('returns a server error for mock=error, which is not treated as "no learner"', async () => {
        const result = await withMocks('error', fetchLearner);
        expect(result.data).toBeNull();
        expect(result.error?.status).toBe(500);
        expect(isNoLearnerError(result.error)).toBe(false);
    });
});
