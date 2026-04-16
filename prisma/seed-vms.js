const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
    console.log('Seeding VMS Data...');

    // 1. Roles
    const roles = ['SUPER_ADMIN', 'MANAGER', 'NOC_JABODETABEK', 'NOC_JATIM', 'NOC_BALI', 'CUSTOMER'];
    const roleEntities = {};
    for (const r of roles) {
        roleEntities[r] = await prisma.role.upsert({
            where: { name: r },
            update: {},
            create: { name: r }
        });
    }

    // 2. Department & Location (Required for user)
    const itOps = await prisma.department.upsert({
        where: { name: 'IT Operations' },
        update: {},
        create: { name: 'IT Operations' }
    });

    const jakarta = await prisma.location.upsert({
        where: { id: 1 },
        update: {},
        create: { city: 'Jakarta', departmentId: itOps.id }
    });

    // 3. DC Sites
    const dcJkt = await prisma.dCSite.upsert({
        where: { code: 'JKT-01' },
        update: {},
        create: { code: 'JKT-01', name: 'Datacenter Jakarta 1', nocEmail: 'noc.jkt@vms.local' }
    });
    
    const dcSby = await prisma.dCSite.upsert({
        where: { code: 'SBY-01' },
        update: {},
        create: { code: 'SBY-01', name: 'Datacenter Surabaya', nocEmail: 'noc.sby@vms.local' }
    });

    const dcBali = await prisma.dCSite.upsert({
        where: { code: 'DPS-01' },
        update: {},
        create: { code: 'DPS-01', name: 'Datacenter Bali', nocEmail: 'noc.bali@vms.local' }
    });

    // 4. Users
    const passwordHash = await bcrypt.hash('password123', 10);
    
    await prisma.user.upsert({
        where: { email: 'superadmin@vms.local' },
        update: {},
        create: {
            email: 'superadmin@vms.local',
            name: 'Super Admin',
            password: passwordHash,
            roleId: roleEntities['SUPER_ADMIN'].id,
            departmentId: itOps.id,
            locationId: jakarta.id
        }
    });

    await prisma.user.upsert({
        where: { email: 'manager@vms.local' },
        update: {},
        create: {
            email: 'manager@vms.local',
            name: 'DC Manager',
            password: passwordHash,
            roleId: roleEntities['MANAGER'].id,
            departmentId: itOps.id,
            locationId: jakarta.id
        }
    });

    // NOC Teams
    await prisma.user.upsert({
        where: { email: dcJkt.nocEmail },
        update: {},
        create: {
            email: dcJkt.nocEmail,
            name: 'NOC Jakarta',
            password: passwordHash,
            roleId: roleEntities['NOC_JABODETABEK'].id,
            departmentId: itOps.id,
            locationId: jakarta.id
        }
    });

    // 5. Customer
    const corpCust = await prisma.customer.upsert({
        where: { name: 'PT Sejahtera Sentosa' },
        update: {},
        create: {
            name: 'PT Sejahtera Sentosa',
            contactEmail: 'customer@vms.local'
        }
    });

    await prisma.user.upsert({
        where: { email: 'customer@vms.local' },
        update: {},
        create: {
            email: 'customer@vms.local',
            name: 'Customer Representative',
            password: passwordHash,
            roleId: roleEntities['CUSTOMER'].id,
            departmentId: itOps.id,
            locationId: jakarta.id
        }
    });

    // 6. Racks and Equipments for Testing
    const testRack = await prisma.rack.create({
        data: {
            siteId: dcJkt.id,
            name: 'RACK-A1',
            uCapacity: 42
        }
    });

    await prisma.rackEquipment.create({
        data: {
            rackId: testRack.id,
            customerId: corpCust.id,
            name: 'Router Cisco',
            uStart: 40,
            uEnd: 42
        }
    });

    console.log('Seeding completed successfully!');
}

main().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
