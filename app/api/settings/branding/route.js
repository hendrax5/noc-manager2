import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { updateAppConfig, getAppConfig } from '@/lib/config';

export async function GET() {
  const config = getAppConfig();
  return NextResponse.json(config);
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const newConfig = await req.json();
    const updated = updateAppConfig(newConfig);

    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    console.error('Branding API Error:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
