import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await prisma.ticket.updateMany({
      where: {
        status: {
          in: ['On Hold', 'onhold', 'Hold', 'on hold']
        }
      },
      data: {
        status: 'Open'
      }
    });
    return NextResponse.json({ success: true, count: res.count });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
