const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
     let initialNotes = [];
     initialNotes.push({
       content: "**Agenda Topics:**\nTesting 123",
       authorId: 1
     });

     const meeting = await prisma.meeting.create({
       data: { 
         title: "Test API Native", 
         agenda: "Testing 123", 
         problems: "",
         scheduledAt: new Date(),
         organizedById: 1,
         notes: { create: initialNotes }
       }
     });
     console.log("✅ Success! Database works:", meeting.title);
     await prisma.meeting.delete({ where: { id: meeting.id } });
  } catch (err) {
     console.error("❌ Prisma Error:", err.message);
  }
}

main().finally(() => prisma.$disconnect());
