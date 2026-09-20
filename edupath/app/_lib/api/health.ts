import { HealthResponse, Result } from './types';
import { apiClient, isMockMode, getMockState } from './client';

export async function fetchHealth(): Promise<Result<HealthResponse>> {
  if (isMockMode()) {
    const mockState = getMockState();
    
    if (mockState === 'loading') {
      return new Promise(() => {}); // never resolves
    }

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
        data: { db: 'ok', ai: 'ok', seededRoles: 0, seededRoleNames: [] },
        error: null,
      };
    }

    // Default 'ok' mock response
    return {
      data: { db: 'ok', ai: 'fixtures', seededRoles: 1, seededRoleNames: ['Data Analyst (junior)'] },
      error: null,
    };
  }

  return apiClient<HealthResponse>('/api/health');
}
