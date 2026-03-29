const { PrismaClient } = require('@prisma/client');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Helper to sanitize Hesk status to our system
const mapStatus = (heskStatus) => {
  // Hesk Status: 0=New, 1=Waiting Reply, 2=Replied, 3=Resolved, 4=In Progress, 5=On Hold
  switch (heskStatus) {
    case 0: return 'New';
    case 1: return 'Waiting Reply';
    case 2: return 'Replied';
    case 3: return 'Resolved';
    case 4: return 'In Progress';
    case 5: return 'On Hold';
    default: return 'New';
  }
};

// Helper to map Priority
const mapPriority = (heskPriority) => {
  // Hesk Priority: 0=Critical, 1=High, 2=Medium, 3=Low
  switch (heskPriority) {
    case '0': return 'Critical';
    case '1': return 'High';
    case '2': return 'Medium';
    case '3': return 'Low';
    default: return 'Medium';
  }
};

async function main() {
  console.log('🚀 Starting Hesk Migration Script...');

  // Connect to the temporary MariaDB container
  const heskDb = await mysql.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'root',
    password: 'root',
    database: 'hesk',
  });

  console.log('✅ Connected to MariaDB Temporary Database!');

  // 1. Setup Exact Departments
  let defaultDept = await prisma.department.findFirst({ where: { name: 'General' } });
  if (!defaultDept) {
    defaultDept = await prisma.department.create({ data: { name: 'General' } });
  }

  let defaultRole = await prisma.role.findFirst({ where: { name: 'Staff' } });
  if (!defaultRole) {
    defaultRole = await prisma.role.create({ data: { name: 'Staff' } });
  }

  const defaultPassword = await bcrypt.hash('213', 10);

  // 2. MIGRATE CATEGORIES
  console.log('📥 Migrating Categories...');
  const [categories] = await heskDb.execute('SELECT * FROM hesk6v_categories');
  const catMap = {};
  for (const cat of categories) {
    // Upsert JobCategory
    const jobCat = await prisma.jobCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: { name: cat.name, score: 5 },
    });
    catMap[cat.id] = jobCat.id;
  }
  console.log(`✔️ Migrated ${categories.length} Categories.`);

  // 3. MIGRATE USERS
  console.log('📥 Migrating Users...');
  const [users] = await heskDb.execute('SELECT * FROM hesk6v_users');
  const userMap = {}; // heskUserId -> prismaUserId
  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email || `${u.user}@migration.local` } });
    if (existing) {
      userMap[u.id] = existing.id;
    } else {
      const newUser = await prisma.user.create({
        data: {
          email: u.email || `${u.user}@migration.local`,
          name: u.name,
          password: defaultPassword,
          departmentId: defaultDept.id,
          roleId: defaultRole.id,
          // Ignore hesk privileges, push everyone to noc/technician
        },
      });
      userMap[u.id] = newUser.id;
    }
  }
  console.log(`✔️ Migrated ${users.length} Users.`);

  // Fallback assignee (in case some old tickets point to deleted users)
  const fallbackUserId = userMap[users[0]?.id] || (await prisma.user.findFirst()).id;

  // 4. MIGRATE TICKETS
  console.log('📥 Migrating Tickets (This might take a while)...');
  const [tickets] = await heskDb.execute('SELECT * FROM hesk6v_tickets');
  let ticketsMigrated = 0;
  for (const t of tickets) {
    await prisma.ticket.upsert({
      where: { trackingId: t.trackid },
      update: {},
      create: {
        trackingId: t.trackid,
        title: t.subject || 'No Subject',
        description: t.message + (t.name ? `\n\n[Original Reporter: ${t.name} - ${t.email}]` : ''),
        status: mapStatus(t.status),
        priority: mapPriority(t.priority),
        departmentId: defaultDept.id,
        assigneeId: t.owner ? (userMap[t.owner] || fallbackUserId) : null,
        jobCategoryId: catMap[t.category] || null,
        createdAt: t.dt,
        updatedAt: t.lastchange,
        resolvedAt: t.closedat || (t.status === 3 ? t.lastchange : null),
        customData: { company: 'ION' },
      },
    });
    ticketsMigrated++;
    if (ticketsMigrated % 500 === 0) console.log(`  ... Processed ${ticketsMigrated} tickets`);
  }
  console.log(`✔️ Migrated ${ticketsMigrated} Tickets.`);

  // 5. MIGRATE REPLIES -> COMMENTS
  console.log('📥 Migrating Replies to Comments...');
  const [replies] = await heskDb.execute('SELECT * FROM hesk6v_replies');
  let repliesMigrated = 0;
  for (const r of replies) {
    // Find matching ticket by Hesk ID
    // Hesk replyto is the internal ticket ID, not trackid. We need to find the trackingId from hesk tickets.
    const [parentTicket] = await heskDb.execute('SELECT trackid FROM hesk6v_tickets WHERE id = ?', [r.replyto]);
    if (parentTicket && parentTicket.length > 0) {
      const trackId = parentTicket[0].trackid;
      const prismaTicket = await prisma.ticket.findUnique({ where: { trackingId: trackId } });
      if (prismaTicket) {
        await prisma.comment.create({
          data: {
            text: r.message,
            ticketId: prismaTicket.id,
            authorId: r.staffid ? (userMap[r.staffid] || fallbackUserId) : fallbackUserId,
            createdAt: r.dt,
          }
        });
        repliesMigrated++;
        if (repliesMigrated % 500 === 0) console.log(`  ... Processed ${repliesMigrated} replies`);
      }
    }
  }
  console.log(`✔️ Migrated ${repliesMigrated} Replies/Comments.`);

  console.log('🎉 Migration Completed Successfully!');
  await prisma.$disconnect();
  await heskDb.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
