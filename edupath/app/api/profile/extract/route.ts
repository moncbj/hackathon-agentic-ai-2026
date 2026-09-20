// app/api/profile/extract/route.ts
// HTTP handler for CV / document text extraction and Profile Agent analysis (SPEC-001)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractTextFromFile, extractTextFromString } from '@/lib/pdf';
import { extractProfile, ProfileExtractError } from '@/services/profile-extract';

export const dynamic = 'force-dynamic';

const JsonExtractRequestSchema = z.object({
  text: z.string().trim().min(1, 'Text is required and cannot be empty'),
  targetRoleId: z.string().uuid('Invalid targetRoleId format'),
});

const RoleIdSchema = z.string().uuid('Invalid targetRoleId format');

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';

  let documentText = '';
  let targetRoleId = '';

  // 1. Handle multipart/form-data (file upload: PDF or TXT)
  if (contentType.includes('multipart/form-data')) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse form data' },
        { status: 400 }
      );
    }

    const rawRoleId = formData.get('targetRoleId');
    if (!rawRoleId || typeof rawRoleId !== 'string') {
      return NextResponse.json(
        { error: 'targetRoleId is required in form data' },
        { status: 400 }
      );
    }

    const roleParsed = RoleIdSchema.safeParse(rawRoleId);
    if (!roleParsed.success) {
      return NextResponse.json(
        { error: 'Invalid targetRoleId format', details: roleParsed.error.issues },
        { status: 400 }
      );
    }
    targetRoleId = roleParsed.data;

    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'No file provided in form data' },
        { status: 400 }
      );
    }

    const filename = file instanceof File ? file.name : 'upload';
    const buffer = Buffer.from(await file.arrayBuffer());

    const extraction = await extractTextFromFile(buffer, file.type, filename);
    if (!extraction.ok) {
      return NextResponse.json(
        {
          error: extraction.error.message,
          code: extraction.error.code,
        },
        { status: 400 }
      );
    }

    documentText = extraction.data.text;
  }
  // 2. Handle application/json (pasted text)
  else if (contentType.includes('application/json')) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body in request' },
        { status: 400 }
      );
    }

    const parsed = JsonExtractRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    targetRoleId = parsed.data.targetRoleId;

    const extraction = extractTextFromString(parsed.data.text);
    if (!extraction.ok) {
      return NextResponse.json(
        {
          error: extraction.error.message,
          code: extraction.error.code,
        },
        { status: 400 }
      );
    }

    documentText = extraction.data.text;
  } else {
    return NextResponse.json(
      { error: 'Content-Type must be application/json or multipart/form-data' },
      { status: 400 }
    );
  }

  // 3. Delegate to profile extraction service
  try {
    const result = await extractProfile({
      documentText,
      targetRoleId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof ProfileExtractError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          details: err.details,
        },
        { status: err.status }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to extract profile',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
