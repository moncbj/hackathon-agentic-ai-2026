import { ApiError, Result } from './types';

/**
 * Normalizes any error thrown during a fetch call into a consistent ApiError format.
 */
export function normalizeError(error: unknown, status?: number): ApiError {
  if (error instanceof SyntaxError) {
    return { type: 'parse', message: 'Received invalid data from the server.' };
  }

  // Network errors from fetch are handled explicitly in the apiClient catch block now,
  // so any other error falling through to here is unknown.
  return { type: 'unknown', message: 'An unexpected error occurred.', status };
}

/**
 * A typed fetch wrapper that handles basic error normalization.
 */
export async function apiClient<T>(url: string, options?: RequestInit): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch {
    // Any exception thrown by fetch() itself is a network failure
    return { data: null, error: { type: 'network', message: 'A network error occurred. Please check your connection.' } };
  }

  if (!response.ok) {
    return {
      data: null,
      error: {
        type: 'http',
        message: 'The server responded with an error.',
        status: response.status
      }
    };
  }

  try {
    const data = await response.json();
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: normalizeError(error, response.status) };
  }
}

export const isMockMode = () => process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

export function getMockState(): string | null {
  if (!isMockMode()) return null;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('mock');
  }
  return null;
}
