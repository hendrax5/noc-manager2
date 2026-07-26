/**
 * SLA policy engine (P0).
 * Priority → response / resolution targets (minutes).
 * Business-hours aware via optional calendar config; falls back to wall-clock.
 */

import { getAppConfig } from "@/lib/config";

export const DEFAULT_SLA_POLICY = Object.freeze({
  Low: { responseMins: 240, resolutionMins: 1440, followUpMins: 60 },
  Medium: { responseMins: 60, resolutionMins: 480, followUpMins: 30 },
  High: { responseMins: 30, resolutionMins: 240, followUpMins: 20 },
  Critical: { responseMins: 15, resolutionMins: 120, followUpMins: 15 },
});

export function getSlaPolicy() {
  const config = getAppConfig();
  const custom = config.slaPolicy && typeof config.slaPolicy === "object" ? config.slaPolicy : {};
  return {
    ...DEFAULT_SLA_POLICY,
    ...custom,
    businessHours: config.slaBusinessHours || null,
  };
}

export function getPrioritySla(priority = "Medium") {
  const policy = getSlaPolicy();
  return policy[priority] || policy.Medium || DEFAULT_SLA_POLICY.Medium;
}

/**
 * Add minutes to a date. If businessHours configured as
 * { startHour: 8, endHour: 17, days: [1,2,3,4,5] } (Mon=1..Sun=0/7),
 * only count minutes inside the window. Otherwise wall-clock.
 */
export function addSlaMinutes(fromDate, minutes, businessHours = null) {
  const start = new Date(fromDate);
  if (!businessHours || !businessHours.startHour || !businessHours.endHour) {
    return new Date(start.getTime() + minutes * 60000);
  }

  const days = Array.isArray(businessHours.days) ? businessHours.days : [1, 2, 3, 4, 5];
  let remaining = minutes;
  let cursor = new Date(start);

  let guard = 0;
  while (remaining > 0 && guard < 20000) {
    guard += 1;
    const dow = cursor.getDay(); // 0 Sun
    const dayOk = days.includes(dow) || days.includes(dow === 0 ? 7 : dow);
    const hour = cursor.getHours() + cursor.getMinutes() / 60;
    const windowStart = businessHours.startHour;
    const windowEnd = businessHours.endHour;

    if (!dayOk || hour >= windowEnd) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(windowStart, 0, 0, 0);
      continue;
    }
    if (hour < windowStart) {
      cursor.setHours(windowStart, 0, 0, 0);
      continue;
    }

    const minsLeftToday = Math.max(0, (windowEnd - (cursor.getHours() + cursor.getMinutes() / 60 + cursor.getSeconds() / 3600)) * 60);
    const consume = Math.min(remaining, Math.ceil(minsLeftToday));
    cursor = new Date(cursor.getTime() + consume * 60000);
    remaining -= consume;
  }

  return cursor;
}

export function buildSlaDeadlines({ priority, enableSla, slaTimerMins, from = new Date() }) {
  if (!enableSla) {
    return {
      enableSla: false,
      slaTimerMins: slaTimerMins ? parseInt(slaTimerMins, 10) : 15,
      responseDueAt: null,
      resolutionDueAt: null,
      nextSlaDeadline: null,
    };
  }

  const policy = getSlaPolicy();
  const row = getPrioritySla(priority);
  const followUp = slaTimerMins ? parseInt(slaTimerMins, 10) : row.followUpMins;
  const responseDueAt = addSlaMinutes(from, row.responseMins, policy.businessHours);
  const resolutionDueAt = addSlaMinutes(from, row.resolutionMins, policy.businessHours);
  const followUpDeadline = addSlaMinutes(from, followUp, policy.businessHours);
  // Alarm uses the nearest actionable deadline
  const nextSlaDeadline = new Date(Math.min(responseDueAt.getTime(), followUpDeadline.getTime()));

  return {
    enableSla: true,
    slaTimerMins: followUp,
    responseDueAt,
    resolutionDueAt,
    nextSlaDeadline,
  };
}

export function refreshFollowUpDeadline({ priority, slaTimerMins, from = new Date() }) {
  const policy = getSlaPolicy();
  const row = getPrioritySla(priority);
  const mins = slaTimerMins || row.followUpMins;
  return addSlaMinutes(from, mins, policy.businessHours);
}
