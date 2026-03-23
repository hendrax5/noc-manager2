import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: { role: true, department: true }
    });
    return NextResponse.json({ 
      status: "Ok", 
      totalUsers: users.length,
      users: users.map(u => ({ email: u.email, password: u.password, role: u.role?.name }))
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
