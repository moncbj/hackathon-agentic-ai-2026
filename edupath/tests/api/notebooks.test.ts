// tests/api/notebooks.test.ts
// Integration tests for Notebooks API endpoints (SPEC-005 §3.4, §5)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as listGET, POST as createPOST } from '@/app/api/notebooks/route';
import { GET as getGET, PATCH as updatePATCH, DELETE as deleteDELETE } from '@/app/api/notebooks/[id]/route';
import * as notebooksService from '@/services/notebooks';

describe('API > /api/notebooks', () => {
  const mockNotebook = {
    id: 'nb-123',
    learner_id: 'learner-456',
    title: 'SQL Join Types',
    content: 'INNER JOIN, LEFT JOIN, FULL JOIN',
    created_at: '2026-01-01T10:00:00Z',
    skills: [
      {
        id: 'skill-sql',
        slug: 'sql',
        name: 'SQL',
        level: 2,
        status: 'in_progress',
      },
    ],
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('GET /api/notebooks returns 200 and list of notebooks', async () => {
    vi.spyOn(notebooksService, 'listNotebooks').mockResolvedValue([mockNotebook]);

    const res = await listGET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].title).toBe('SQL Join Types');
  });

  it('POST /api/notebooks returns 201 on successful creation', async () => {
    vi.spyOn(notebooksService, 'createNotebook').mockResolvedValue(mockNotebook);

    const req = new NextRequest('http://localhost:3000/api/notebooks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'SQL Join Types',
        content: 'INNER JOIN, LEFT JOIN, FULL JOIN',
        skillIds: ['skill-sql'],
      }),
    });

    const res = await createPOST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBe('nb-123');
  });

  it('POST /api/notebooks returns 400 when title is missing or too long', async () => {
    vi.spyOn(notebooksService, 'createNotebook').mockRejectedValue(
      new notebooksService.NotebookServiceError('Notebook title is required', 400, 'INVALID_TITLE')
    );

    const req = new NextRequest('http://localhost:3000/api/notebooks', {
      method: 'POST',
      body: JSON.stringify({
        title: '',
        content: 'Content',
        skillIds: ['skill-sql'],
      }),
    });

    const res = await createPOST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe('INVALID_TITLE');
  });

  it('GET /api/notebooks/:id returns 200 and notebook details', async () => {
    vi.spyOn(notebooksService, 'getNotebook').mockResolvedValue(mockNotebook);

    const req = new NextRequest('http://localhost:3000/api/notebooks/nb-123');
    const res = await getGET(req, { params: Promise.resolve({ id: 'nb-123' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('nb-123');
  });

  it('GET /api/notebooks/:id returns 404 when notebook not found', async () => {
    vi.spyOn(notebooksService, 'getNotebook').mockRejectedValue(
      new notebooksService.NotebookServiceError('Notebook not found', 404, 'NOTEBOOK_NOT_FOUND')
    );

    const req = new NextRequest('http://localhost:3000/api/notebooks/nonexistent');
    const res = await getGET(req, { params: Promise.resolve({ id: 'nonexistent' }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('NOTEBOOK_NOT_FOUND');
  });

  it('PATCH /api/notebooks/:id updates and returns 200', async () => {
    vi.spyOn(notebooksService, 'updateNotebook').mockResolvedValue({
      ...mockNotebook,
      title: 'Renamed Title',
    });

    const req = new NextRequest('http://localhost:3000/api/notebooks/nb-123', {
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Renamed Title',
      }),
    });

    const res = await updatePATCH(req, { params: Promise.resolve({ id: 'nb-123' }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.title).toBe('Renamed Title');
  });

  it('DELETE /api/notebooks/:id deletes and returns 200', async () => {
    vi.spyOn(notebooksService, 'deleteNotebook').mockResolvedValue({ success: true });

    const req = new NextRequest('http://localhost:3000/api/notebooks/nb-123', {
      method: 'DELETE',
    });

    const res = await deleteDELETE(req, { params: Promise.resolve({ id: 'nb-123' }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
