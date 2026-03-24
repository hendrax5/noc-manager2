import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { updateAppConfig, getAppConfig } from '@/lib/config';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { departmentId, companyName } = await req.json();
    if (!departmentId) {
      return NextResponse.json({ error: 'Missing departmentId' }, { status: 400 });
    }

    const currentConfig = getAppConfig();
    const deptCompanyMap = currentConfig.deptCompanyMap || {};

    if (companyName) {
      deptCompanyMap[departmentId] = companyName;
    } else {
      delete deptCompanyMap[departmentId];
    }

    const updated = updateAppConfig({ ...currentConfig, deptCompanyMap });

    return NextResponse.json({ success: true, deptCompanyMap: updated.deptCompanyMap });
  } catch (error) {
    console.error('Dept Routing API Error:', error);
    return NextResponse.json({ error: 'Failed to update department routing' }, { status: 500 });
  }
}
