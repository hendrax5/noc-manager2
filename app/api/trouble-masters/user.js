import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function getMasterUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const id = Number(session.user.id);
  if (!Number.isSafeInteger(id)) return null;
  return prisma.user.findUnique({ where: { id }, include: { role: true } });
}
