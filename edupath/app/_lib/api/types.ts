export interface ApiError {
  type: 'network' | 'http' | 'parse' | 'unknown';
  message: string;
  status?: number;
}

export interface HealthResponse {
  db: 'ok' | 'error';
  ai: 'ok' | 'fixtures' | 'error';
  seededRoles: number;
  seededRoleNames: string[];
}

export interface Result<T> {
  data: T | null;
  error: ApiError | null;
}
