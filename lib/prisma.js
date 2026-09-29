import { PrismaClient } from '@prisma/client'

const globalForPrisma = global

// Password hashes are never returned (incl. nested relations) unless a query opts in with
// `omit: { password: false }` — only auth, profile password change, and DB backup do.
export const prisma = globalForPrisma.prisma || new PrismaClient({
  omit: { user: { password: true } },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
