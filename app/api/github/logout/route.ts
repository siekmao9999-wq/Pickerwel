import { NextResponse } from 'next/server';
import { clearGitHubCookies } from '@/lib/github-oauth';

export async function POST() {
  const res = NextResponse.json({ disconnected: true });
  clearGitHubCookies(res);
  return res;
}
