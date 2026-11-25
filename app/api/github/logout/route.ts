import { NextRequest, NextResponse } from 'next/server';
import { assertValidCsrfRequest, clearGitHubCookies } from '@/lib/github-oauth';

export async function POST(req: NextRequest) {
  if (!assertValidCsrfRequest(req)) {
    return NextResponse.json({ error: 'FORBIDDEN_ORIGIN' }, { status: 403 });
  }

  const res = NextResponse.json({ disconnected: true });
  clearGitHubCookies(res);
  return res;
}
