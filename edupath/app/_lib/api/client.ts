import { ApiError, Result } from './types';

/**
 * Normalizes any error thrown during a fetch call into a consistent ApiError format.
 */
export function normalizeError(error: unknown, status?: number): ApiError {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return { type: 'network', message: 'A network error occurred. Please check your connection.' };
  }
  
  if (error instanceof SyntaxError) {
    return { type: 'parse', message: 'Received invalid data from the server.' };
  }

  if (typeof error === 'object' && error !== null && 'type' in error) {
    return error as ApiError;
  }

  return { type: 'unknown', message: 'An unexpected error occurred.', status };
}

/**
 * A typed fetch wrapper that handles basic error normalization.
 */
export async function apiClient<T>(url: string, options?: RequestInit): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    return { data: null, error: normalizeError(error) };
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

export const isMockMode = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

export function getMockState(): string | null {
  if (!isMockMode) return null;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('mock');
  }
  return null;
}
