import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeError, apiClient, isMockMode, getMockState } from '../app/_lib/api/client';
import { fetchHealth } from '../app/_lib/api/health';

describe('API Client Error Normalization', () => {
  it('should normalize JSON parse errors', () => {
    const err = new SyntaxError('Unexpected token o in JSON at position 1');
    const result = normalizeError(err);
    expect(result.type).toBe('parse');
  });

  it('should fall back to unknown for arbitrary errors without trusting type property', () => {
    const spoofedError = { type: 'http', message: 'Fake error' };
    const result = normalizeError(spoofedError, 500);
    expect(result.type).toBe('unknown');
    expect(result.status).toBe(500);
  });
});

describe('Mock Mode logic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should correctly expose mock mode flag based on env', () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = 'true';
    expect(isMockMode()).toBe(true);
    
    process.env.NEXT_PUBLIC_USE_MOCKS = 'false';
    expect(isMockMode()).toBe(false);
  });

  it('should return null mock state when not in browser environment (SSR)', () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = 'true';
    const mockState = getMockState();
    expect(mockState).toBeNull();
  });

  it('should return a promise that never resolves when mock=loading', async () => {
    process.env.NEXT_PUBLIC_USE_MOCKS = 'true';
    global.window = {
      location: { search: '?mock=loading' }
    } as any;

    let resolved = false;
    const p = fetchHealth().then(() => { resolved = true; });
    
    vi.useFakeTimers();
    vi.advanceTimersByTime(2000);
    
    await Promise.resolve(); // flush microtasks
    
    expect(resolved).toBe(false);
    
    vi.useRealTimers();
    delete (global as any).window;
  });
});

describe('API Client fetch wrapper', () => {
  it('should return data on successful fetch', async () => {
    const mockData = { test: 'ok' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await apiClient('/api/test');
    expect(result.error).toBeNull();
    expect(result.data).toEqual(mockData);
  });

  it('should return http error on non-2xx response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await apiClient('/api/test');
    expect(result.data).toBeNull();
    expect(result.error?.type).toBe('http');
    expect(result.error?.status).toBe(404);
  });

  it('should return network error when fetch throws any exception', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Some weird browser network error'));
    const result = await apiClient('/api/test');
    expect(result.data).toBeNull();
    expect(result.error?.type).toBe('network');
  });
});
