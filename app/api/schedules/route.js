import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { dateOnlyToUtcDate, toDateOnlyString } from "@/lib/schedules/dates";
import { canEditSchedules } from "@/lib/schedules/access";

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
          select: {
            id: true,
            name: true,
            email: true,
            location: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
          },
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
 * PATCH — edit cell (shift / highlight / note) or swap two cells.
 * Editors: Admin, Manager, manage_schedules
 */
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !canEditSchedules(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const actorId = session.user.id ? parseInt(session.user.id, 10) : null;

    if (body.action === "swap") {
      return swapCells(body);
    }

    const userId = parseInt(body.userId, 10);
    const dateStr = toDateOnlyString(body.date);
    if (!userId || !dateStr) {
      return NextResponse.json({ error: "userId and date required" }, { status: 400 });
    }

    const data = {};

    if (body.shift != null) {
      const name = String(body.shift).toUpperCase();
      if (name === "OFF" || name === "") {
        data.shiftTypeId = null;
      } else {
        const st = await prisma.shiftType.findFirst({ where: { name } });
        if (!st) {
          return NextResponse.json({ error: `Unknown shift ${name}` }, { status: 400 });
        }
        data.shiftTypeId = st.id;
      }
    } else if (body.shiftTypeId !== undefined) {
      data.shiftTypeId =
        body.shiftTypeId === null || body.shiftTypeId === ""
          ? null
          : parseInt(body.shiftTypeId, 10);
    }

    if (body.highlightColor !== undefined) {
      const hex = body.highlightColor;
      if (hex === null || hex === "" || hex === "clear") {
        data.highlightColor = null;
      } else if (/^#[0-9A-Fa-f]{6}$/.test(String(hex))) {
        data.highlightColor = String(hex).toLowerCase();
      } else {
        return NextResponse.json({ error: "highlightColor must be #RRGGBB or null" }, { status: 400 });
      }
    }

    if (body.note !== undefined) {
      const text = body.note == null ? null : String(body.note).trim();
      data.note = text || null;
      data.noteUpdatedBy = actorId;
      data.noteUpdatedAt = new Date();
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const date = dateOnlyToUtcDate(dateStr);
    const row = await prisma.shiftSchedule.upsert({
      where: { userId_date: { userId, date } },
      update: data,
      create: {
        userId,
        date,
        shiftTypeId: data.shiftTypeId !== undefined ? data.shiftTypeId : null,
        highlightColor: data.highlightColor !== undefined ? data.highlightColor : null,
        note: data.note !== undefined ? data.note : null,
        noteUpdatedBy: data.noteUpdatedBy ?? null,
        noteUpdatedAt: data.noteUpdatedAt ?? null,
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

  const aPayload = {
    shiftTypeId: aRow?.shiftTypeId ?? null,
    highlightColor: aRow?.highlightColor ?? null,
    note: aRow?.note ?? null,
    noteUpdatedBy: aRow?.noteUpdatedBy ?? null,
    noteUpdatedAt: aRow?.noteUpdatedAt ?? null,
  };
  const bPayload = {
    shiftTypeId: bRow?.shiftTypeId ?? null,
    highlightColor: bRow?.highlightColor ?? null,
    note: bRow?.note ?? null,
    noteUpdatedBy: bRow?.noteUpdatedBy ?? null,
    noteUpdatedAt: bRow?.noteUpdatedAt ?? null,
  };

  const [aOut, bOut] = await prisma.$transaction([
    prisma.shiftSchedule.upsert({
      where: { userId_date: { userId: aUser, date: aDate } },
      update: bPayload,
      create: { userId: aUser, date: aDate, ...bPayload },
      include: { shiftType: true },
    }),
    prisma.shiftSchedule.upsert({
      where: { userId_date: { userId: bUser, date: bDate } },
      update: aPayload,
      create: { userId: bUser, date: bDate, ...aPayload },
      include: { shiftType: true },
    }),
  ]);

  return NextResponse.json({ a: aOut, b: bOut });
}
