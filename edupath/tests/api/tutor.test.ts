// tests/api/tutor.test.ts
// Integration tests for POST /api/tutor/chat (SPEC-005 §3.4, §5)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/tutor/chat/route';
import * as tutorService from '@/services/tutor';

describe('API > POST /api/tutor/chat', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 200 with answer and followUps when service succeeds', async () => {
    vi.spyOn(tutorService, 'handleTutorChat').mockResolvedValue({
      answer: 'Esta semana tienes actividades de SQL.',
      followUps: ['¿Qué es un JOIN?', '¿Cómo practicar?'],
      suggestedAction: {
        type: 'open_journey',
      },
    });

    const req = new NextRequest('http://localhost:3000/api/tutor/chat', {
      method: 'POST',
      body: JSON.stringify({
        question: '¿Qué tengo que hacer esta semana?',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.answer).toBe('Esta semana tienes actividades de SQL.');
    expect(body.followUps).toHaveLength(2);
    expect(body.suggestedAction).toEqual({ type: 'open_journey' });
  });

  it('returns 400 when question is missing or empty', async () => {
    vi.spyOn(tutorService, 'handleTutorChat').mockRejectedValue(
      new tutorService.TutorServiceError('Question is required', 400, 'INVALID_QUESTION')
    );

    const req = new NextRequest('http://localhost:3000/api/tutor/chat', {
      method: 'POST',
      body: JSON.stringify({
        question: '',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('Question is required');
    expect(body.code).toBe('INVALID_QUESTION');
  });

  it('returns 404 when no active learner profile exists', async () => {
    vi.spyOn(tutorService, 'handleTutorChat').mockRejectedValue(
      new tutorService.TutorServiceError('No active learner profile found. Complete onboarding first.', 404, 'NO_LEARNER')
    );

    const req = new NextRequest('http://localhost:3000/api/tutor/chat', {
      method: 'POST',
      body: JSON.stringify({
        question: 'What is my status?',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.code).toBe('NO_LEARNER');
  });

  it('returns 502 when AI agent encounters an error', async () => {
    vi.spyOn(tutorService, 'handleTutorChat').mockRejectedValue(
      new tutorService.TutorServiceError('Tutor agent temporarily unavailable', 502, 'AI_ERROR')
    );

    const req = new NextRequest('http://localhost:3000/api/tutor/chat', {
      method: 'POST',
      body: JSON.stringify({
        question: 'Explain SQL',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(502);

    const body = await res.json();
    expect(body.code).toBe('AI_ERROR');
  });
});
