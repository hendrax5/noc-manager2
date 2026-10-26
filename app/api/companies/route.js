import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getCompanies } from '@/lib/companies/server';
import { companyOptions } from '@/lib/companies/registry';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const serviceOnly = new URL(request.url).searchParams.get('service') === '1';
  const companies = await getCompanies();
  return NextResponse.json({ companies, options: companyOptions(companies, { serviceOnly }) });
}
