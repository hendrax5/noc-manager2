import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Menghindari seed ganda
    const existing = await prisma.user.findUnique({ where: { email: 'admin@noc.com' } });
    if (existing) return NextResponse.json({ message: 'Already seeded' });

    // Seed Data Basic Role
    const adminRole = await prisma.role.create({ data: { name: 'Admin' } });
    await prisma.role.create({ data: { name: 'Manager' } });
    await prisma.role.create({ data: { name: 'Staff' } });

    // Seed Data Basic Department
    const deptNocCore = await prisma.department.create({ data: { name: 'NOC Core' } });
    await prisma.department.create({ data: { name: 'NOC Datacenter' } });
    await prisma.department.create({ data: { name: 'CS' } });

    // Seed Admin User
    const adminUser = await prisma.user.create({
      data: {
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
