import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user } = session;
    const hasPermission = user.permissions?.includes('view_reports') || user.role === 'Admin' || user.role === 'Manager';
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const locationId = searchParams.get("locationId");
    const departmentId = searchParams.get("departmentId");

    // Establish boundaries in local timezone representation
    const startOfDay = new Date(`${dateStr}T00:00:00`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999`);

    // Fetch active users with shifts
    const userWhere = {};
    if (locationId) userWhere.locationId = parseInt(locationId);
    if (departmentId) userWhere.departmentId = parseInt(departmentId);

    // Only monitor technicians, staff, managers and admins who have department IDs (active team members)
    const users = await prisma.user.findMany({
      where: {
        ...userWhere,
        role: { name: { in: ['Staff', 'Manager', 'Admin'] } }
      },
      include: {
        department: true,
        role: true,
        schedules: {
          where: {
            date: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          include: {
            shiftType: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Fetch all ticket history records for the target day
    const historyLogs = await prisma.ticketHistory.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        ticket: {
          select: {
            id: true,
            trackingId: true,
            title: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Fetch all comments for the target day
    const comments = await prisma.comment.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        ticket: {
          select: {
            id: true,
            trackingId: true,
            title: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const gapThresholdMs = 45 * 60 * 1000; // 45 minutes gap threshold
    const bufferMs = 15 * 60 * 1000;       // 15 minutes buffer time

    const usersTimelineData = users.map(u => {
      // 1. Resolve Shift schedule
      let shiftName = "No Shift Scheduled";
      let shiftStartTime = "08:00";
      let shiftEndTime = "17:00";
      let hasScheduledShift = false;

      if (u.schedules && u.schedules.length > 0 && u.schedules[0].shiftType) {
        const st = u.schedules[0].shiftType;
        shiftName = st.name;
        shiftStartTime = st.startTime;
        shiftEndTime = st.endTime;
        hasScheduledShift = true;
      }

      // Convert shift start/end to absolute dates on the target date
      const [sH, sM] = shiftStartTime.split(":").map(Number);
      const [eH, eM] = shiftEndTime.split(":").map(Number);

      const shiftStart = new Date(startOfDay);
      shiftStart.setHours(sH, sM, 0, 0);

      const shiftEnd = new Date(startOfDay);
      shiftEnd.setHours(eH, eM, 0, 0);

      // Handle overnight shifts crossing midnight
      if (shiftEnd <= shiftStart) {
        shiftEnd.setDate(shiftEnd.getDate() + 1);
      }

      // 2. Gather activities
      const userHistory = historyLogs
        .filter(l => l.actorId === u.id)
        .map(l => ({
          id: `history-${l.id}`,
          timestamp: new Date(l.createdAt),
          action: l.action,
          ticketId: l.ticketId,
          ticketTrackingId: l.ticket?.trackingId || null,
          ticketTitle: l.ticket?.title || null
        }));

      const userComments = comments
        .filter(c => c.authorId === u.id)
        .map(c => ({
          id: `comment-${c.id}`,
          timestamp: new Date(c.createdAt),
          action: "Reply appended to thread",
          ticketId: c.ticketId,
          ticketTrackingId: c.ticket?.trackingId || null,
          ticketTitle: c.ticket?.title || null
        }));

      const activities = [...userHistory, ...userComments]
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // 3. Construct active blocks from activities
      const activeBlocks = [];
      if (activities.length > 0) {
        let currentBlock = {
          start: new Date(activities[0].timestamp.getTime() - bufferMs),
          end: new Date(activities[0].timestamp.getTime() + bufferMs),
          activities: [activities[0]]
        };

        for (let i = 1; i < activities.length; i++) {
          const act = activities[i];
          const actTime = act.timestamp.getTime();
          const prevActTime = currentBlock.activities[currentBlock.activities.length - 1].timestamp.getTime();

          if (actTime - prevActTime <= gapThresholdMs) {
            // Extend current block
            currentBlock.end = new Date(actTime + bufferMs);
            currentBlock.activities.push(act);
          } else {
            // Commit current block and start new one
            activeBlocks.push(currentBlock);
            currentBlock = {
              start: new Date(actTime - bufferMs),
              end: new Date(actTime + bufferMs),
              activities: [act]
            };
          }
        }
        activeBlocks.push(currentBlock);
      }

      // Clip active blocks to absolute day boundaries (00:00 to 23:59:59)
      activeBlocks.forEach(block => {
        if (block.start < startOfDay) block.start = new Date(startOfDay);
        if (block.end > endOfDay) block.end = new Date(endOfDay);
      });

      // 4. Split active blocks into shift and overtime segments
      const timelineSegments = [];

      const splitInterval = (start, end) => {
        const segments = [];
        const sStart = shiftStart.getTime();
        const sEnd = shiftEnd.getTime();

        // 4a. Overtime before shift
        if (start < sStart) {
          const segEnd = Math.min(end, sStart);
          segments.push({
            start: new Date(start),
            end: new Date(segEnd),
            type: "overtime"
          });
        }

        // 4b. Active during shift
        if (end > sStart && start < sEnd) {
          const segStart = Math.max(start, sStart);
          const segEnd = Math.min(end, sEnd);
          segments.push({
            start: new Date(segStart),
            end: new Date(segEnd),
            type: "active"
          });
        }

        // 4c. Overtime after shift
        if (end > sEnd) {
          const segStart = Math.max(start, sEnd);
          segments.push({
            start: new Date(segStart),
            end: new Date(end),
            type: "overtime"
          });
        }

        return segments;
      };

      activeBlocks.forEach(block => {
        const splitSegs = splitInterval(block.start.getTime(), block.end.getTime());
        splitSegs.forEach(seg => {
          timelineSegments.push({
            ...seg,
            activities: block.activities
          });
        });
      });

      // 5. Calculate idle periods within shift
      // Grab active blocks which fall inside the shift, cropped to shift boundaries
      const shiftActiveIntervals = activeBlocks
        .map(block => ({
          start: Math.max(block.start.getTime(), shiftStart.getTime()),
          end: Math.min(block.end.getTime(), shiftEnd.getTime())
        }))
        .filter(interval => interval.start < interval.end);

      // Sort intervals chronologically
      shiftActiveIntervals.sort((a, b) => a.start - b.start);

      // Merge overlapping/adjacent intervals inside the shift active ranges for idle calculations
      const mergedShiftActiveIntervals = [];
      if (shiftActiveIntervals.length > 0) {
        let current = shiftActiveIntervals[0];
        for (let i = 1; i < shiftActiveIntervals.length; i++) {
          const next = shiftActiveIntervals[i];
          if (next.start <= current.end) {
            current.end = Math.max(current.end, next.end);
          } else {
            mergedShiftActiveIntervals.push(current);
            current = next;
          }
        }
        mergedShiftActiveIntervals.push(current);
      }

      const idleSegments = [];
      let lastEnd = shiftStart.getTime();

      mergedShiftActiveIntervals.forEach(interval => {
        if (interval.start > lastEnd) {
          idleSegments.push({
            start: new Date(lastEnd),
            end: new Date(interval.start),
            type: "idle",
            activities: []
          });
        }
        if (interval.end > lastEnd) {
          lastEnd = interval.end;
        }
      });

      if (lastEnd < shiftEnd.getTime()) {
        idleSegments.push({
          start: new Date(lastEnd),
          end: new Date(shiftEnd.getTime()),
          type: "idle",
          activities: []
        });
      }

      // Combine all segments chronologically
      const segments = [...timelineSegments, ...idleSegments]
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      // 6. Calculate statistics
      const shiftDurationMs = shiftEnd.getTime() - shiftStart.getTime();
      const activeInShiftMs = timelineSegments
        .filter(s => s.type === "active")
        .reduce((sum, s) => sum + (s.end.getTime() - s.start.getTime()), 0);
      const idleInShiftMs = idleSegments
        .reduce((sum, s) => sum + (s.end.getTime() - s.start.getTime()), 0);
      const overtimeMs = timelineSegments
        .filter(s => s.type === "overtime")
        .reduce((sum, s) => sum + (s.end.getTime() - s.start.getTime()), 0);

      const toHours = (ms) => parseFloat((ms / (1000 * 60 * 60)).toFixed(2));

      const shiftHours = toHours(shiftDurationMs);
      const activeHours = toHours(activeInShiftMs);
      const idleHours = toHours(idleInShiftMs);
      const overtimeHours = toHours(overtimeMs);
      const totalEffectiveHours = toHours(activeInShiftMs + overtimeMs);

      const efficiencyRate = shiftDurationMs > 0
        ? Math.round((activeInShiftMs / shiftDurationMs) * 100)
        : 0;

      // Determine local timeline start/end for this user (which will define their bar range)
      const userTimelineStart = Math.min(shiftStart.getTime(), ...activeBlocks.map(b => b.start.getTime()));
      const userTimelineEnd = Math.max(shiftEnd.getTime(), ...activeBlocks.map(b => b.end.getTime()));

      // 7. Diligence & Loyalty Analysis (Analyzing ticket activity detail, volume and quality keywords)
      const userCommentsForDiligence = comments.filter(c => c.authorId === u.id);
      const uniqueTicketsHandled = new Set(activities.map(a => a.ticketId).filter(Boolean));
      
      let totalWordCount = 0;
      userCommentsForDiligence.forEach(c => {
        const words = c.text ? c.text.trim().split(/\s+/).filter(Boolean).length : 0;
        totalWordCount += words;
      });
      const avgWordCount = userCommentsForDiligence.length > 0 
        ? totalWordCount / userCommentsForDiligence.length 
        : 0;

      let diligenceScore = 0;
      const matchedKeywords = new Set();
      const diligenceKeywords = [
        "mohon", "maaf", "terima kasih", "investigasi", "analisa", 
        "solusi", "bandwidth", "port", "kabel", "perangkat", 
        "rincian", "langkah", "restart", "ping", "konfigurasi", "cek"
      ];

      if (activities.length > 0) {
        // A. Volume Score (up to 25 pts)
        diligenceScore += Math.min(25, activities.length * 2.5);

        // B. Detail/Word count Score (up to 25 pts)
        if (userCommentsForDiligence.length > 0) {
          if (avgWordCount > 30) diligenceScore += 25;
          else if (avgWordCount > 15) diligenceScore += 15;
          else if (avgWordCount > 5) diligenceScore += 10;
          else diligenceScore += 3;
        } else {
          diligenceScore += 10; // Default baseline if active but no comments
        }

        // C. Communication Ratio (up to 25 pts)
        const commRatio = uniqueTicketsHandled.size > 0 
          ? userCommentsForDiligence.length / uniqueTicketsHandled.size 
          : 0;
        if (commRatio >= 1.5) diligenceScore += 25;
        else if (commRatio >= 0.8) diligenceScore += 15;
        else if (commRatio >= 0.3) diligenceScore += 8;
        else diligenceScore += 2;

        // D. Keyword detection for quality (up to 25 pts)
        userCommentsForDiligence.forEach(c => {
          const lowerText = (c.text || "").toLowerCase();
          diligenceKeywords.forEach(kw => {
            if (lowerText.includes(kw)) {
              matchedKeywords.add(kw);
            }
          });
        });
        diligenceScore += Math.min(25, matchedKeywords.size * 5);
      }

      diligenceScore = Math.round(diligenceScore);

      let diligenceLevel = "Tidak Ada Aktivitas";
      let feedbackText = "Tidak ada catatan aktivitas atau pengerjaan tiket pada hari ini.";
      
      if (activities.length > 0) {
        if (diligenceScore >= 75) {
          diligenceLevel = "Sangat Loyal & Dedikatif";
          feedbackText = `PIC sangat berdedikasi tinggi, memberikan dokumentasi yang sangat detail (rata-rata ${avgWordCount.toFixed(1)} kata per balasan) dan menunjukkan kepedulian tinggi dalam penyelesaian masalah.`;
        } else if (diligenceScore >= 50) {
          diligenceLevel = "Efisien & Responsif";
          feedbackText = "PIC bekerja secara profesional dan efisien. Memberikan koordinasi yang memadai untuk menyelesaikan pekerjaan.";
        } else if (diligenceScore >= 25) {
          diligenceLevel = "Standar / Minimalis";
          feedbackText = "PIC menyelesaikan pekerjaan dengan respons secukupnya. Dokumentasi dan komunikasi tiket tergolong standar.";
        } else {
          diligenceLevel = "Sekadarnya (Bare Minimum)";
          feedbackText = "Peringatan: PIC terindikasi hanya melakukan pekerjaan sekadarnya. Dokumentasi tiket sangat minim, didominasi oleh kata-kata singkat tanpa rincian teknis.";
        }
      }

      return {
        user: {
          id: u.id,
          name: u.name || u.email,
          email: u.email,
          department: u.department?.name || "General",
          avatarUrl: u.avatarUrl
        },
        shift: {
          name: shiftName,
          startTime: shiftStartTime,
          endTime: shiftEndTime,
          start: shiftStart.toISOString(),
          end: shiftEnd.toISOString(),
          hasScheduledShift
        },
        stats: {
          shiftHours,
          activeHours,
          idleHours,
          overtimeHours,
          totalEffectiveHours,
          efficiencyRate
        },
        timelineRange: {
          start: userTimelineStart,
          end: userTimelineEnd
        },
        segments: segments.map(seg => ({
          start: seg.start.toISOString(),
          end: seg.end.toISOString(),
          type: seg.type,
          durationMins: Math.round((seg.end.getTime() - seg.start.getTime()) / 60000),
          activityCount: seg.activities.length
        })),
        activities: activities.map(act => ({
          id: act.id,
          timestamp: act.timestamp.toISOString(),
          action: act.action,
          ticketId: act.ticketId,
          ticketTrackingId: act.ticketTrackingId,
          ticketTitle: act.ticketTitle
        })),
        diligence: {
          score: diligenceScore,
          level: diligenceLevel,
          avgWordCount: parseFloat(avgWordCount.toFixed(1)),
          feedbackText,
          keywordsDetected: Array.from(matchedKeywords)
        }
      };
    });

    // Determine global minimum and maximum timeline values for rendering
    let globalStart = new Date(`${dateStr}T08:00:00`).getTime();
    let globalEnd = new Date(`${dateStr}T17:00:00`).getTime();

    usersTimelineData.forEach(u => {
      if (u.timelineRange.start < globalStart) globalStart = u.timelineRange.start;
      if (u.timelineRange.end > globalEnd) globalEnd = u.timelineRange.end;
    });

    return NextResponse.json({
      date: dateStr,
      globalRange: {
        start: new Date(globalStart).toISOString(),
        end: new Date(globalEnd).toISOString()
      },
      users: usersTimelineData
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
