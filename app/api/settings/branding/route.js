import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { updateAppConfig, getAppConfig } from '@/lib/config';
import { sanitizeCompanies, companyNamesText } from '@/lib/companies/registry';

const hasPermission = session =>
  session?.user?.permissions?.includes('manage_settings') || session?.user?.role === 'Admin';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !hasPermission(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const config = await getAppConfig();
  return NextResponse.json(config);
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !hasPermission(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const patch = { ...body };
    if (body.companies !== undefined) {
      let companies;
      try {
        companies = sanitizeCompanies(body.companies);
      } catch (validationError) {
        return NextResponse.json({ error: validationError.message }, { status: 400 });
      }
      if (!companies) {
        return NextResponse.json({ error: 'Daftar perusahaan tidak valid.' }, { status: 400 });
      }
      if (!companies.some(item => item.active && item.serviceSelectable)) {
        return NextResponse.json({ error: 'Minimal satu perusahaan harus bisa dipilih untuk layanan.' }, { status: 400 });
      }
      patch.companies = companies;
      patch.companyNames = companyNamesText(companies);
    }

    const updated = await updateAppConfig(patch);
    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    console.error('Branding API Error:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
