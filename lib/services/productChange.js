/**
 * Product/template change for an existing service.
 *
 * Switching products must keep the capacity fields coherent: OPEN PORT requires
 * ≥ 10 Gbps and DARKFIBER requires a pair count. The helper returns the customData
 * to persist, or a user-facing error, so the API and the UI share one rule.
 */

import { darkFiberData } from "./productUnits.js";
import { openPortUpdatedData, validateOpenPortData } from "./productBandwidth.js";

export function planProductChange({ nextTemplate, currentTemplateId, currentCustomData, incomingCustomData } = {}) {
  if (!nextTemplate || nextTemplate.active === false) {
    return { ok: false, error: "Produk/layanan tidak ditemukan atau tidak aktif." };
  }
  const current = currentCustomData && typeof currentCustomData === "object" ? currentCustomData : {};
  const incoming = incomingCustomData && typeof incomingCustomData === "object" ? incomingCustomData : current;

  let customData;
  try {
    customData = darkFiberData(nextTemplate, openPortUpdatedData(nextTemplate, current, incoming), current);
    validateOpenPortData(nextTemplate, customData);
  } catch (error) {
    return { ok: false, error: error?.message || "Produk/layanan tidak valid untuk layanan ini." };
  }

  return {
    ok: true,
    templateId: Number(nextTemplate.id),
    customData,
    changed: Number(nextTemplate.id) !== Number(currentTemplateId),
  };
}
