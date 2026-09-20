// app/api/reports/route.ts
// HTTP route handler for POST /api/reports and GET /api/reports (SPEC-005 §3.4)

import { NextResponse } from 'next/server';
import { generateProgressReport, getRecentReports, ReportServiceError } from '@/services/reports';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const report = await generateProgressReport();
    return NextResponse.json(report, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ReportServiceError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
        },
        { status: err.status }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to generate progress report',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const reports = await getRecentReports(5);
    return NextResponse.json(reports, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof ReportServiceError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
        },
        { status: err.status }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to retrieve progress reports',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
