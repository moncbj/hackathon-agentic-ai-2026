import { HealthResponse, Result } from './types';
import { apiClient, isMockMode, getMockState } from './client';

export async function fetchHealth(): Promise<Result<HealthResponse>> {
  if (isMockMode) {
    const mockState = getMockState();
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    if (mockState === 'error') {
      return { 
        data: null, 
        error: { type: 'http', message: 'Simulated error state', status: 500 } 
      };
    }
    
    if (mockState === 'empty') {
      return {
        data: { db: 'ok', ai: 'ok', seededRoles: 0 },
        error: null,
      };
    }

    // Default 'ok' mock response
    return {
      data: { db: 'ok', ai: 'fixtures', seededRoles: 1 },
      error: null,
    };
  }

  return apiClient<HealthResponse>('/api/health');
}
