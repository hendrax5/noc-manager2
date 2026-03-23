import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/prisma";

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");

    if (!q || q.length < 2) {
      return NextResponse.json([]);
    }

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { cid: { contains: q, mode: 'insensitive' } }
        ]
      },
      take: 15,
      orderBy: { name: 'asc' }
    });

    // Map to a format easily parsed by our Select Component
    const results = customers.map(c => ({
      value: c.name,
      label: c.cid ? `[${c.cid}] ${c.name}` : c.name
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error("CUSTOMER_SEARCH_ERROR:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
