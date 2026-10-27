/**
 * Per-CID recovery checklist for multi-CID tickets (option C:
 * the SLA timer stays ticket-level, but every circuit must be marked recovered
 * before the ticket can be Resolved/Closed).
 *
 * Stored inside Ticket.customData.serviceRecovery to avoid a schema migration:
 * { "<serviceId>": { at: ISO string, by: userId | null } }
 */

export const SERVICE_RECOVERY_KEY = "serviceRecovery";

export function recoveryMap(customData) {
  const value = customData && typeof customData === "object" && !Array.isArray(customData)
    ? customData[SERVICE_RECOVERY_KEY]
    : null;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function markServiceRecovery(customData, serviceId, { recovered, at = new Date().toISOString(), by = null } = {}) {
  const base = customData && typeof customData === "object" && !Array.isArray(customData) ? customData : {};
  const next = { ...recoveryMap(base) };
  const key = String(serviceId);
  if (recovered) next[key] = { at, by };
  else delete next[key];
  return { ...base, [SERVICE_RECOVERY_KEY]: next };
}

export function pendingRecoveryServices(services, customData) {
  const map = recoveryMap(customData);
  return (services || []).filter((service) => !map[String(service.id)]);
}

export function recoveredServiceCount(services, customData) {
  const total = (services || []).length;
  return total - pendingRecoveryServices(services, customData).length;
}

/**
 * The checklist is a multi-CID concern, matching the Resolve/Close gate above.
 * Single-CID tickets (including new installations) must not show it.
 */
export function shouldShowRecoveryChecklist(services) {
  return (services || []).length > 1;
}

/** Multi-CID tickets may only close when no circuit is pending. */
export function assertServicesRecovered(services, customData) {
  const pending = pendingRecoveryServices(services, customData);
  return {
    ok: (services || []).length <= 1 || pending.length === 0,
    pending,
  };
}
