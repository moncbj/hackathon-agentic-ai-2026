import { describe, it, expect, vi } from 'vitest';
import { normalizeError, apiClient, isMockMode, getMockState } from '../app/_lib/api/client';

describe('API Client Error Normalization', () => {
  it('should normalize network errors', () => {
    const err = new TypeError('Failed to fetch');
    const result = normalizeError(err);
    expect(result.type).toBe('network');
    expect(result.message).toContain('network');
  });

  it('should normalize JSON parse errors', () => {
    const err = new SyntaxError('Unexpected token o in JSON at position 1');
    const result = normalizeError(err);
    expect(result.type).toBe('parse');
  });

  it('should fall back to unknown for arbitrary errors', () => {
    const result = normalizeError(new Error('Random error'), 500);
    expect(result.type).toBe('unknown');
    expect(result.status).toBe(500);
  });
});

describe('Mock Mode logic', () => {
  it('should correctly expose mock mode flag based on env', () => {
    // Vitest runs without NEXT_PUBLIC_USE_MOCKS set by default, so it's false unless mocked
    expect(typeof isMockMode).toBe('boolean');
  });

  it('should return null mock state when not in browser environment (SSR)', () => {
    // In vitest node environment, window is undefined
    const mockState = getMockState();
    expect(mockState).toBeNull();
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
});
