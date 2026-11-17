import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { withCustomerCode } from '@/lib/customers/identity';
import { mergeCustomerRecords, CustomerMergeError } from '@/lib/customers/mergeCustomers';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user.role !== 'Admin' && !session.user.permissions?.includes('manage_assets'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const result = await prisma.$transaction(
      (tx) => mergeCustomerRecords(tx, body, Number(session.user.id)),
      { timeout: 30000 },
    );

    return NextResponse.json({
      ...result,
      target: withCustomerCode(result.target),
      archivedSource: withCustomerCode(result.archivedSource),
    });
  } catch (error) {
    if (error instanceof CustomerMergeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Payload tidak valid.' }, { status: 400 });
    }
    console.error('CUSTOMER_MERGE_ERROR:', error);
    return NextResponse.json({ error: 'Customer gagal digabungkan. Coba lagi.' }, { status: 500 });
  }
}
