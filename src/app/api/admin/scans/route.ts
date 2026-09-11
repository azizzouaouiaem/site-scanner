import { NextResponse } from 'next/server';
import { listRecentScans } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const expectedToken = process.env.ADMIN_REPORT_TOKEN;
  const authorization = request.headers.get('authorization');

  if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const scans = await listRecentScans();
    return NextResponse.json({ scans });
  } catch (error) {
    console.error('list_scans_failed', error);
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 });
  }
}