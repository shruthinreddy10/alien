import { NextRequest } from 'next/server';
import { GET as getDashboard } from '@/app/api/dashboard/route';

// Alias /api/v1/dashboard/summary -> /api/dashboard
export async function GET(req: NextRequest) {
  return getDashboard(req);
}
