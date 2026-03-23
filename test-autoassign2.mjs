import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const departmentId = 7;
  const deptUsers = await prisma.user.findMany({ 
    where: { departmentId: parseInt(departmentId), role: { name: { not: 'Admin' } } }, 
    select: { id: true } 
  });
  console.log("Dept users:", deptUsers.length);
  if (deptUsers.length > 0) {
    const activeTicketsCount = await prisma.ticket.groupBy({
      by: ['assigneeId'],
      where: { assigneeId: { in: deptUsers.map(u => u.id) }, status: { not: 'Resolved' } },
      _count: { id: true }
    });
    
    const loadMap = {};
    deptUsers.forEach(u => loadMap[u.id] = 0);
    activeTicketsCount.forEach(l => { if (l.assigneeId) loadMap[l.assigneeId] = l._count.id; });
    
    let minLoad = Infinity;
    let finalAssigneeId = null;
    for (const [uid, count] of Object.entries(loadMap)) {
      if (count < minLoad) {
        minLoad = count;
        finalAssigneeId = parseInt(uid);
      }
    }
    console.log("Final Assignee:", finalAssigneeId);
  } else {
    console.log("No dept users!");
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
