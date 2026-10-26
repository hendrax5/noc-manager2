/**
 * Subject builders for the ticket creation form.
 *
 * The form keeps the subject in sync automatically until the operator edits it.
 * Subjects use explicit labels ("CID:", "Site") and never repeat the customer
 * name, which already has its own field on the ticket.
 */

const SUBJECT_MAX = 500;
const LEGAL_FORMS = new Set(["PT", "CV", "UD", "PD", "TBK", "PERSERO", "LTD", "INC", "LLC"]);
const SEPARATORS = "[\\s.,\\-_/()|:;]*";
const LEGAL_TOKEN = "(?:PT|CV|UD|PD|TBK|PERSERO|LTD)\\.?";
const LEADING_SEPARATORS = /^[\s.,\-–—_/:|;]+/;
const LEADING_LEGAL = /^(?:PT|CV|UD|PD|TBK|PERSERO|LTD)\.?(?=[\s.,\-–—_/:|;]|$)/i;
const LEADING_SITE = /^SITE\b[\s:.\-–—]*/i;
/** Leftover closing bracket after a customer prefix that carried a brand note. */
const LEADING_CLOSING_BRACKET = /^\)+[\s.,\-–—_/:|;]*/;
/** Brand note left after the customer prefix: "(AKSES NET) Site : OFFICE …". */
const LEADING_NOTE = /^\([^)]*\)[\s.,\-–—_/:|;]*/;
/** Brand note directly followed by the site marker. */
const LEADING_NOTE_BEFORE_SITE = /^\([^)]*\)[\s.,\-–—_/:|;]*(?=SITE\b)/i;
const TRAILING_SEPARATORS = /[\s.,\-–—_/:|;]+$/;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function words(text) {
  return String(text ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Customer name without legal forms, used for the loose prefix comparison. */
function coreWords(text) {
  return words(text).filter(word => !LEGAL_FORMS.has(word));
}

/** Same, with parenthetical brand notes removed: "MEDIA AKSES DATA (MMD)" -> [MEDIA, AKSES, DATA]. */
function coreWordsWithoutParentheticals(text) {
  return coreWords(String(text ?? "").replace(/\([^)]*\)/g, " "));
}

function prefixPattern(tokens) {
  const body = tokens.map(escapeRegExp).join(SEPARATORS);
  return new RegExp(`^\\s*(?:${LEGAL_TOKEN}${SEPARATORS})?${body}(?:${SEPARATORS}${LEGAL_TOKEN})?`, "i");
}

/** Drop separators, stray legal forms and a leading "Site" marker left behind by the strip. */
function cleanSiteName(text, { stripped = false } = {}) {
  let next = String(text ?? "").trim();
  for (let guard = 0; guard < 6; guard += 1) {
    const previous = next;
    next = next
      .replace(LEADING_SEPARATORS, "")
      .replace(LEADING_CLOSING_BRACKET, "")
      .replace(LEADING_LEGAL, "")
      .replace(LEADING_SEPARATORS, "")
      .replace(LEADING_NOTE_BEFORE_SITE, "")
      .trim();
    if (stripped) {
      next = next.replace(LEADING_NOTE, "").replace(LEADING_SEPARATORS, "").trim();
    }
    next = next.replace(LEADING_SITE, "").trim();
    if (next === previous) break;
  }
  return next.replace(TRAILING_SEPARATORS, "").trim();
}

/**
 * Site name without the customer prefix, e.g.
 * ("PT Vissie Cyber Data Site POP Tulungagun", "PT Vissie Cyber Data") -> "POP Tulungagun".
 * When the prefix does not match, the name is only tidied.
 */
export function siteLabel(name, customerName) {
  let label = String(name ?? "").trim();
  if (!label) return "";

  const candidates = [];
  const core = coreWords(customerName);
  if (core.length) candidates.push(core);
  const withoutNotes = coreWordsWithoutParentheticals(customerName);
  if (withoutNotes.length && withoutNotes.join(" ") !== core.join(" ")) candidates.push(withoutNotes);

  let stripped = false;
  for (const tokens of candidates) {
    const match = label.match(prefixPattern(tokens));
    if (match) {
      label = label.slice(match[0].length);
      stripped = true;
      break;
    }
  }

  return cleanSiteName(label, { stripped });
}

/**
 * "Instalasi Baru - CID: SAP-C-0006-0770 - Site ERIK CAHYONO (…)":
 * the customer name is never included, and a name that already says "Site" is
 * not decorated a second time.
 */
export function installationSubject({ typeName = "Instalasi Baru", cid, name, customerName } = {}) {
  const cidValue = cid === null || cid === undefined ? "" : String(cid).trim();
  const cidText = cidValue ? `CID: ${cidValue}` : "";
  const site = siteLabel(name, customerName);
  const siteText = site ? (/\bsite\b/i.test(site) ? site : `Site ${site}`) : "";

  return [typeName, cidText, siteText]
    .map(part => (part ? String(part).trim() : ""))
    .filter(Boolean)
    .join(" - ")
    .slice(0, SUBJECT_MAX);
}

/** "<Jenis pekerjaan> - <CID | nama layanan>" for non-installation service work. */
export function serviceWorkSubject(typeName, service, resolvedCid) {
  const source = service || {};
  const text = [typeName, resolvedCid || source.cid || source.name]
    .map(value => (value === null || value === undefined ? "" : String(value).trim()))
    .filter(Boolean)
    .join(" - ");
  return text.slice(0, SUBJECT_MAX) || String(typeName || "").slice(0, SUBJECT_MAX);
}
