import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { dateOnlyToUtcDate, toDateOnlyString } from "@/lib/schedules/dates";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const locationId = searchParams.get("locationId");

    const whereClause = {};
    if (start && end) {
      whereClause.date = { gte: new Date(start), lte: new Date(end) };
    }
    if (locationId) {
      whereClause.user = { locationId: parseInt(locationId) };
    }

    const schedules = await prisma.shiftSchedule.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, email: true, location: true, departmentId: true },
        },
        shiftType: true,
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(schedules);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH — edit one cell or swap two cells.
 * Body:
 *  { userId, date: "YYYY-MM-DD", shiftTypeId?: number|null, shift?: "OFF"|"S1"|... }
 *  { action: "swap", a: { userId, date }, b: { userId, date } }
 */
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    const hasPermission =
      session?.user?.permissions?.includes("manage_schedules") ||
      session?.user?.role === "Admin";
    if (!session || !hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    if (body.action === "swap") {
      return swapCells(body);
    }

    const userId = parseInt(body.userId, 10);
    const dateStr = toDateOnlyString(body.date);
    if (!userId || !dateStr) {
      return NextResponse.json({ error: "userId and date required" }, { status: 400 });
    }

    let shiftTypeId = body.shiftTypeId;
    if (body.shift != null) {
      const name = String(body.shift).toUpperCase();
      if (name === "OFF" || name === "") {
        shiftTypeId = null;
      } else {
        const st = await prisma.shiftType.findFirst({ where: { name } });
        if (!st) {
          return NextResponse.json({ error: `Unknown shift ${name}` }, { status: 400 });
        }
        shiftTypeId = st.id;
      }
    } else if (shiftTypeId !== undefined && shiftTypeId !== null) {
      shiftTypeId = parseInt(shiftTypeId, 10);
    }

    const date = dateOnlyToUtcDate(dateStr);
    const row = await prisma.shiftSchedule.upsert({
      where: { userId_date: { userId, date } },
      update: { shiftTypeId: shiftTypeId === undefined ? undefined : shiftTypeId },
      create: {
        userId,
        date,
        shiftTypeId: shiftTypeId === undefined ? null : shiftTypeId,
      },
      include: { shiftType: true, user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(row);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function swapCells(body) {
  const aUser = parseInt(body.a?.userId, 10);
  const bUser = parseInt(body.b?.userId, 10);
  const aDateStr = toDateOnlyString(body.a?.date);
  const bDateStr = toDateOnlyString(body.b?.date);
  if (!aUser || !bUser || !aDateStr || !bDateStr) {
    return NextResponse.json(
      { error: "swap requires a/b { userId, date }" },
      { status: 400 }
    );
  }

  const aDate = dateOnlyToUtcDate(aDateStr);
  const bDate = dateOnlyToUtcDate(bDateStr);

  const [aRow, bRow] = await Promise.all([
    prisma.shiftSchedule.findUnique({ where: { userId_date: { userId: aUser, date: aDate } } }),
    prisma.shiftSchedule.findUnique({ where: { userId_date: { userId: bUser, date: bDate } } }),
  ]);

  const aShift = aRow?.shiftTypeId ?? null;
  const bShift = bRow?.shiftTypeId ?? null;

  const [aOut, bOut] = await prisma.$transaction([
    prisma.shiftSchedule.upsert({
      where: { userId_date: { userId: aUser, date: aDate } },
      update: { shiftTypeId: bShift },
      create: { userId: aUser, date: aDate, shiftTypeId: bShift },
      include: { shiftType: true },
    }),
    prisma.shiftSchedule.upsert({
      where: { userId_date: { userId: bUser, date: bDate } },
      update: { shiftTypeId: aShift },
      create: { userId: bUser, date: bDate, shiftTypeId: aShift },
      include: { shiftType: true },
    }),
  ]);

  return NextResponse.json({ a: aOut, b: bOut });
}
