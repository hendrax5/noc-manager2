const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const categories = [
    { name: 'General Information', description: 'General NOC guidelines', icon: '🗣️' },
    { name: 'Routing & BGP', description: 'L3 configurations and protocols', icon: '🌐' },
    { name: 'Metro-E & L2', description: 'VLANs and Layer 2 tunneling', icon: '🌉' },
    { name: 'Fiber Optic / OSP', description: 'Physical layer troubleshooting', icon: '🔌' },
    { name: 'Customer SOPs', description: 'Specific customer escalation trees', icon: '🏢' },
  ];

  for (const c of categories) {
    await prisma.knowledgeCategory.upsert({
      where: { name: c.name },
      update: {},
      create: c
    });
  }

  console.log('Knowledge Base Categories seeded successfully!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
