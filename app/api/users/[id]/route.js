import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { hashPassword, omitPassword } from "@/lib/auth/password";
import { dateOnlyToUtcDate, nowInJakarta } from "@/lib/schedules/dates";
import { isManuallyProtectedCell } from "@/lib/schedules/protection";

async function requireManageUsers(session) {
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const actorId = parseInt(session.user.id, 10);
  const dbUser = await prisma.user.findUnique({
    where: { id: actorId },
    include: { role: true },
  });
  const hasPermission =
    dbUser?.role?.permissions?.includes("manage_users") || dbUser?.role?.name === "Admin";
  if (!dbUser || !hasPermission) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { actorId, dbUser };
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireManageUsers(session);
    if (auth.error) return auth.error;

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (!id) return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const data = {};

    if (body.name !== undefined) data.name = body.name ? String(body.name).trim() : null;
    if (body.email !== undefined) {
      const cleanEmail = String(body.email || "").trim().toLowerCase();
      if (!cleanEmail) {
        return NextResponse.json({ error: "Email tidak boleh kosong" }, { status: 400 });
      }
      data.email = cleanEmail;
    }
    if (body.roleId !== undefined) data.roleId = parseInt(body.roleId, 10);
    if (body.departmentId !== undefined) data.departmentId = parseInt(body.departmentId, 10);
    if (body.locationId !== undefined) {
      data.locationId =
        body.locationId === null || body.locationId === "" ? null : parseInt(body.locationId, 10);
    }
    if (typeof body.scheduleEligible === "boolean") {
      data.scheduleEligible = body.scheduleEligible;
    }
    if (body.scheduleFlag && ["Umum", "Kristen", "Kuliah"].includes(body.scheduleFlag)) {
      data.scheduleFlag = body.scheduleFlag;
    }
    if (body.password && String(body.password).trim()) {
      data.password = await hashPassword(body.password);
    }

    let cleanedFutureSchedules = 0;
    if (typeof body.active === "boolean") {
      if (id === auth.actorId && body.active === false) {
        return NextResponse.json(
          { error: "Tidak dapat menonaktifkan akun Anda sendiri yang sedang login." },
          { status: 400 }
        );
      }
      data.active = body.active;
      if (body.active === false) {
        const resignDate =
          body.resignedAt && /^\d{4}-\d{2}-\d{2}/.test(String(body.resignedAt))
            ? dateOnlyToUtcDate(String(body.resignedAt).slice(0, 10))
            : new Date();
        data.resignedAt = resignDate;
        data.inactiveReason = body.inactiveReason
          ? String(body.inactiveReason).trim()
          : "Resign";
        data.scheduleEligible = false;

        if (body.cleanupFutureSchedules !== false) {
          const jakarta = nowInJakarta();
          const todayStr = `${jakarta.year}-${String(jakarta.month).padStart(2, "0")}-${String(jakarta.day).padStart(2, "0")}`;
          const cutoffStr =
            body.resignedAt && /^\d{4}-\d{2}-\d{2}/.test(String(body.resignedAt))
              ? String(body.resignedAt).slice(0, 10)
              : todayStr;
          const cutoffDate = dateOnlyToUtcDate(cutoffStr);

          const futureRows = await prisma.shiftSchedule.findMany({
            where: { userId: id, date: { gt: cutoffDate } },
            select: {
              id: true,
              shiftTypeId: true,
              generatedShiftTypeId: true,
              isLembur: true,
              manualEdited: true,
              highlightColor: true,
              note: true,
              noteUpdatedBy: true,
            },
          });
          const deletableIds = futureRows
            .filter((r) => !isManuallyProtectedCell(r))
            .map((r) => r.id);
          if (deletableIds.length > 0) {
            const del = await prisma.shiftSchedule.deleteMany({
              where: { id: { in: deletableIds } },
            });
            cleanedFutureSchedules = del.count;
          }
        }
      } else {
        data.resignedAt = null;
        data.inactiveReason = null;
        if (body.scheduleEligible === undefined) {
          const roleIdToCheck = data.roleId ?? existingUser.roleId;
          const targetRole = await prisma.role.findUnique({ where: { id: roleIdToCheck } });
          data.scheduleEligible = targetRole?.name !== "Manager";
        }
      }
    } else if (body.inactiveReason !== undefined) {
      data.inactiveReason = body.inactiveReason ? String(body.inactiveReason).trim() : null;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      include: { role: true, department: true, location: true },
    });

    return NextResponse.json({
      ...omitPassword(user),
      cleanedFutureSchedules,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireManageUsers(session);
    if (auth.error) return auth.error;

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id, 10);
    if (!id) return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

    if (id === auth.actorId) {
      return NextResponse.json(
        { error: "Tidak dapat menghapus akun Anda sendiri yang sedang login." },
        { status: 400 }
      );
    }

    const [ticketsCount, schedulesCount, reportsCount, commentsCount] = await Promise.all([
      prisma.ticket.count({ where: { assigneeId: id } }),
      prisma.shiftSchedule.count({ where: { userId: id } }),
      prisma.dailyReport.count({ where: { authorId: id } }),
      prisma.comment.count({ where: { authorId: id } }),
    ]);

    if (ticketsCount + schedulesCount + reportsCount + commentsCount > 0) {
      return NextResponse.json(
        {
          code: "HAS_HISTORY",
          error:
            "User memiliki riwayat tiket, laporan, atau jadwal. Gunakan status Nonaktif / Resign agar riwayat tetap utuh.",
        },
        { status: 409 }
      );
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    if (error?.code === "P2003") {
      return NextResponse.json(
        {
          code: "HAS_HISTORY",
          error:
            "User masih terhubung ke data historis. Gunakan Nonaktif / Resign agar data lama aman.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
