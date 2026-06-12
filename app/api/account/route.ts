import { NextRequest, NextResponse } from 'next/server';
import { getAccountAccess } from '@/lib/auth';
import { isDatabaseConfigured } from '@/lib/db';
import { getUsageStatus } from '@/lib/usageLimits';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = await getAccountAccess();
  const usage = await getUsageStatus(access, request.cookies.get('cp_guest_id')?.value);
  return NextResponse.json(
    {
      ...access,
      ...usage,
      historyReady: access.configured && isDatabaseConfigured(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
