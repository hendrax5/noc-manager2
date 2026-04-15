// Permission Seed Script
// Run with: node prisma/seed-permissions.js
// Seeds Permission table + maps defaults to Admin/Manager/Staff roles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  // Tickets
  { key: 'ticket.create', label: 'Create Tickets', group: 'tickets' },
  { key: 'ticket.view', label: 'View Own Dept Tickets', group: 'tickets' },
  { key: 'ticket.view_all', label: 'View All Departments', group: 'tickets' },
  { key: 'ticket.reply', label: 'Reply to Tickets', group: 'tickets' },
  { key: 'ticket.edit', label: 'Edit Own Dept Tickets', group: 'tickets' },
  { key: 'ticket.edit_all', label: 'Edit Any Ticket', group: 'tickets' },
  { key: 'ticket.delete', label: 'Delete Tickets', group: 'tickets' },
  { key: 'ticket.assign', label: 'Reassign Tickets', group: 'tickets' },
  { key: 'ticket.sla', label: 'Manage SLA Timers', group: 'tickets' },
  // Meetings
  { key: 'meeting.create', label: 'Create Meetings', group: 'meetings' },
  { key: 'meeting.edit', label: 'Edit Meetings', group: 'meetings' },
  { key: 'meeting.view_all', label: 'View All Meetings', group: 'meetings' },
  // Knowledge Base
  { key: 'kb.create', label: 'Create Articles', group: 'knowledge' },
  { key: 'kb.edit_all', label: 'Edit Any Article', group: 'knowledge' },
  { key: 'kb.delete', label: 'Delete Articles', group: 'knowledge' },
  // Reports
  { key: 'report.view', label: 'View Reports', group: 'reports' },
  { key: 'report.export', label: 'Export Reports', group: 'reports' },
  // Team
  { key: 'team.manage', label: 'Manage Team Members', group: 'team' },
  { key: 'team.schedule', label: 'Manage Schedules', group: 'team' },
  // Settings
  { key: 'settings.manage', label: 'System Settings', group: 'settings' },
  { key: 'settings.fields', label: 'Custom Fields Config', group: 'settings' },
  { key: 'settings.backup', label: 'Database Backup', group: 'settings' },
];

// Role → permission keys mapping
const ROLE_DEFAULTS = {
  'Admin': ALL_PERMISSIONS.map(p => p.key), // Admin gets everything
  'Manager': [
    'ticket.create', 'ticket.view', 'ticket.reply', 'ticket.edit', 'ticket.assign', 'ticket.sla',
    'meeting.create', 'meeting.edit',
    'kb.create', 'kb.edit_all', 'kb.delete',
    'report.view', 'report.export',
    'team.schedule',
  ],
  'Staff': [
    'ticket.create', 'ticket.view', 'ticket.reply',
  ],
  'CS': [
    'ticket.create', 'ticket.view', 'ticket.view_all', 'ticket.reply', 'ticket.edit', 'ticket.assign', 'ticket.sla',
    'report.view',
  ],
};

async function main() {
  console.log('🔐 Seeding permission system...');

  // Upsert all permissions
  for (const perm of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { label: perm.label, group: perm.group },
      create: perm,
    });
  }
  console.log(`✅ ${ALL_PERMISSIONS.length} permissions seeded.`);

  // Fetch all permissions for ID mapping
  const allPerms = await prisma.permission.findMany();
  const permMap = {};
  allPerms.forEach(p => { permMap[p.key] = p.id; });

  // Map defaults to roles
  const roles = await prisma.role.findMany();
  for (const role of roles) {
    const defaultKeys = ROLE_DEFAULTS[role.name] || ROLE_DEFAULTS['Staff'] || [];
    
    for (const key of defaultKeys) {
      if (!permMap[key]) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permMap[key] } },
        update: {},
        create: { roleId: role.id, permissionId: permMap[key] },
      });
    }
    console.log(`  ✅ Role "${role.name}" → ${defaultKeys.length} permissions assigned.`);
  }

  console.log('🎉 Permission seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
