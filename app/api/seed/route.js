import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Menghindari seed ganda
    const existing = await prisma.user.findUnique({ where: { email: 'admin@noc.com' } });
    if (existing) return NextResponse.json({ message: 'Already seeded' });

    // Seed Data Basic Role
    const adminRole = await prisma.role.upsert({ where: { name: 'Admin' }, update: {}, create: { name: 'Admin' } });
    await prisma.role.upsert({ where: { name: 'Manager' }, update: {}, create: { name: 'Manager' } });
    await prisma.role.upsert({ where: { name: 'Staff' }, update: {}, create: { name: 'Staff' } });

    // Seed Data Basic Department
    const deptNocCore = await prisma.department.upsert({ where: { name: 'NOC Core' }, update: {}, create: { name: 'NOC Core' } });
    await prisma.department.upsert({ where: { name: 'NOC Datacenter' }, update: {}, create: { name: 'NOC Datacenter' } });
    await prisma.department.upsert({ where: { name: 'CS' }, update: {}, create: { name: 'CS' } });

    // Seed Admin User
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@noc.com' },
      update: {},
      create: {
        email: 'admin@noc.com',
        name: 'Super Admin',
        password: 'admin',
        roleId: adminRole.id,
        departmentId: deptNocCore.id,
      }
    });

    return NextResponse.json({ 
      message: 'Database seeded successfully!', 
      user: adminUser.email 
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
