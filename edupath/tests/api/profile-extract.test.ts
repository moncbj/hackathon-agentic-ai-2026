import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/profile/extract/route';
import * as rolesRepo from '@/lib/db/repositories/roles';
import * as skillsRepo from '@/lib/db/repositories/skills';
import * as profileRunner from '@/agents/profile/run';
import { AgentOutputError } from '@/lib/gemini/errors';

describe('API: POST /api/profile/extract', () => {
  const originalEnv = process.env;
  const mockRoleId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';


  const mockRoleSkills = [
    {
      id: 'skill-1',
      slug: 'sql',
      name: 'SQL',
      description: 'SQL desc',
      category: 'Data',
      created_at: '2026-01-01',
      required_level: 3,
      weight: 1,
    },
    {
      id: 'skill-2',
      slug: 'basic-python',
      name: 'Basic Python',
      description: 'Python desc',
      category: 'Programming',
      created_at: '2026-01-01',
      required_level: 2,
      weight: 1,
    },
    {
      id: 'skill-3',
      slug: 'spreadsheets',
      name: 'Spreadsheets',
      description: 'Excel desc',
      category: 'Data',
      created_at: '2026-01-01',
      required_level: 3,
      weight: 1,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv, AI_MODE: 'fixtures' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('extracts profile successfully from JSON pasted text in fixtures mode', async () => {
    vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue({
      id: mockRoleId,
      slug: 'data-analyst',
      name: 'Junior Data Analyst',
      description: '',
      created_at: '',
    });
    vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);

    const req = new NextRequest('http://localhost:3000/api/profile/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'He trabajado 2 años con Python y bases de datos SQL.',
        targetRoleId: mockRoleId,
      }),
    });

    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(200);


    expect(body.proposedSkills).toBeDefined();
    expect(body.proposedSkills.length).toBeGreaterThan(0);
    // Verified enrichment
    for (const prop of body.proposedSkills) {
      expect(prop.skillName).toBeDefined();
      expect(['sql', 'basic-python', 'spreadsheets']).toContain(prop.skillSlug);
    }
    expect(body.summary).toBeDefined();
  });

  it('returns 502 when Profile Agent fails (AgentOutputError)', async () => {
    vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue({
      id: mockRoleId,
      slug: 'data-analyst',
      name: 'Role',
      description: '',
      created_at: '',
    });
    vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);

    vi.spyOn(profileRunner, 'runProfileAgent').mockRejectedValue(
      new AgentOutputError('Model generation timed out or schema invalid')
    );

    const req = new NextRequest('http://localhost:3000/api/profile/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Some CV text content',
        targetRoleId: mockRoleId,
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(502);

    const body = await response.json();
    expect(body.error).toContain('AI extraction failed. Continue manually.');
    expect(body.code).toBe('AI_ERROR');
  });

  it('returns 404 when targetRoleId does not exist', async () => {
    vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/profile/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Some CV text content',
        targetRoleId: mockRoleId,
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.code).toBe('ROLE_NOT_FOUND');
  });

  it('returns 400 when text is empty in JSON request', async () => {
    const req = new NextRequest('http://localhost:3000/api/profile/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '   ',
        targetRoleId: mockRoleId,
      }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('extracts profile successfully from a multipart TXT file upload', async () => {
    vi.spyOn(rolesRepo, 'getRoleById').mockResolvedValue({
      id: mockRoleId,
      slug: 'data-analyst',
      name: 'Role',
      description: '',
      created_at: '',
    });
    vi.spyOn(skillsRepo, 'getSkillsByRole').mockResolvedValue(mockRoleSkills);

    const formData = new FormData();
    const textBlob = new Blob(['Experiencia con Python y análisis de datos en Excel.'], {
      type: 'text/plain',
    });
    formData.append('file', textBlob, 'curriculum.txt');
    formData.append('targetRoleId', mockRoleId);

    const req = new NextRequest('http://localhost:3000/api/profile/extract', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.proposedSkills).toBeDefined();
  });

  it('returns 400 for disallowed file types in multipart upload', async () => {
    const formData = new FormData();
    const jsonBlob = new Blob(['{"data": 123}'], { type: 'application/json' });
    formData.append('file', jsonBlob, 'data.json');
    formData.append('targetRoleId', mockRoleId);

    const req = new NextRequest('http://localhost:3000/api/profile/extract', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.code).toBe('INVALID_TYPE');
  });

  it('returns 400 when file in multipart upload exceeds 5MB', async () => {
    const formData = new FormData();
    // 5MB + 1 byte
    const largeBlob = new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], {
      type: 'application/pdf',
    });
    formData.append('file', largeBlob, 'large.pdf');
    formData.append('targetRoleId', mockRoleId);

    const req = new NextRequest('http://localhost:3000/api/profile/extract', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(req);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.code).toBe('FILE_TOO_LARGE');
  });
});
