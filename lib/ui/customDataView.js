/**
 * Safe display helpers for JSON-shaped fields stored in `customData`.
 *
 * `customData` is a free-form JSON column: besides plain form values it can hold
 * integration metadata such as `serviceRouting` (an array of objects). React
 * throws "Objects are not valid as a React child" when such a value is rendered
 * directly, so every UI that lists these values must go through these helpers.
 */

/** Keys written by integration/workflow code that operators should not edit or read as parameters. */
export const INTERNAL_CUSTOM_KEYS = new Set(["serviceRouting", "serviceRecovery"]);

/**
 * Coerce any JSON value into a text child React can render.
 * Objects and arrays are serialised; anything unserialisable falls back to String().
 */
export function formatCustomValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "bigint") return value.toString();
  try {
    const json = JSON.stringify(value);
    return json === undefined ? "" : json;
  } catch {
    return String(value);
  }
}

/**
 * Entries worth showing as "attached parameters": truthy values, minus internal
 * integration keys. Always safe to render through {@link formatCustomValue}.
 */
export function displayableCustomEntries(customData, exclude = INTERNAL_CUSTOM_KEYS) {
  if (!customData || typeof customData !== "object" || Array.isArray(customData)) return [];
  return Object.entries(customData).filter(([key, value]) => Boolean(value) && !exclude.has(key));
}
