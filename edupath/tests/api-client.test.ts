import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeError, apiClient, isMockMode, getMockState } from '../app/_lib/api/client';
import { fetchHealth } from '../app/_lib/api/health';

// Simulates a browser window whose URL has (or lacks) the ?mock= param.
function stubBrowser(mockParam?: string) {
  vi.stubGlobal('window', {
    location: { search: mockParam ? `?mock=${mockParam}` : '' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('normalizeError', () => {
  it('normalizes JSON parse errors', () => {
    const result = normalizeError(new SyntaxError('Unexpected token'));
    expect(result.type).toBe('parse');
  });

  it('falls back to unknown and never trusts a spoofed type property', () => {
    const result = normalizeError({ type: 'http', message: 'Fake error' }, 500);
    expect(result.type).toBe('unknown');
    expect(result.status).toBe(500);
  });
});

describe('apiClient', () => {
  it('returns data on a successful response', async () => {
    const payload = { test: 'ok' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) }));

    const result = await apiClient('/api/test');
    expect(result.error).toBeNull();
    expect(result.data).toEqual(payload);
  });

  it('returns an http error on a non-2xx response, without leaking the body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const result = await apiClient('/api/test');
    expect(result.data).toBeNull();
    expect(result.error?.type).toBe('http');
    expect(result.error?.status).toBe(404);
  });

  it('returns a network error when fetch throws any exception', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Some weird browser network error')));

    const result = await apiClient('/api/test');
    expect(result.data).toBeNull();
    expect(result.error?.type).toBe('network');
  });

  it('returns a parse error when the body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.reject(new SyntaxError('bad json')) }),
    );

    const result = await apiClient('/api/test');
    expect(result.data).toBeNull();
    expect(result.error?.type).toBe('parse');
  });
});

describe('mock mode', () => {
  it('exposes the mock flag based on the env var', () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
    expect(isMockMode()).toBe(true);

    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'false');
    expect(isMockMode()).toBe(false);
  });

  it('returns null on the server (no window) even with mocks enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
    expect(getMockState()).toBeNull();
  });

  it('reads the ?mock= param in the browser when mocks are enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
    stubBrowser('error');
    expect(getMockState()).toBe('error');
  });

  it('ignores the ?mock= param when mocks are disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'false');
    stubBrowser('error');
    expect(getMockState()).toBeNull();
  });
});

describe('fetchHealth with mocks', () => {
  async function runMock(param?: string) {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
    stubBrowser(param);
    vi.useFakeTimers();
    const promise = fetchHealth();
    await vi.advanceTimersByTimeAsync(800);
    return promise;
  }

  it('returns the default ok mock', async () => {
    const result = await runMock();
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      db: 'ok',
      ai: 'fixtures',
      seededRoles: 1,
      seededRoleNames: ['Data Analyst (junior)'],
    });
  });

  it('returns zero seeded roles for mock=empty', async () => {
    const result = await runMock('empty');
    expect(result.data?.seededRoles).toBe(0);
  });

  it('returns an http error for mock=error', async () => {
    const result = await runMock('error');
    expect(result.data).toBeNull();
    expect(result.error?.type).toBe('http');
  });

  it('never settles for mock=loading', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'true');
    stubBrowser('loading');
    vi.useFakeTimers();

    let settled = false;
    fetchHealth().then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(settled).toBe(false);
  });
});

describe('fetchHealth without mocks', () => {
  it('calls the real endpoint and ignores ?mock= when mocks are disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_MOCKS', 'false');
    stubBrowser('error');
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ db: 'ok', ai: 'ok', seededRoles: 2 }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchHealth();
    expect(fetchMock).toHaveBeenCalledWith('/api/health', undefined);
    expect(result.data?.seededRoles).toBe(2);
  });
});
