/**
 * Subject builders for the ticket creation form.
 *
 * The form keeps the subject in sync automatically until the operator edits it.
 * Both helpers cap the text at the subject input limit (500 characters).
 */

const SUBJECT_MAX = 500;

function parts(values) {
  const seen = new Set();
  return values
    .map(value => (value === null || value === undefined ? "" : String(value).trim()))
    .filter(Boolean)
    .filter(part => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * "Instalasi Baru - <CID> - <Nama layanan/site>"
 * Missing pieces are skipped, so a partially filled installation form still
 * produces a usable subject.
 */
export function installationSubject(installation = {}) {
  const text = parts(["Instalasi Baru", installation.cid, installation.name]).join(" - ");
  return text.slice(0, SUBJECT_MAX);
}

/** "<Jenis pekerjaan> - <CID | nama layanan>" for non-installation service work. */
export function serviceWorkSubject(typeName, service, resolvedCid) {
  const source = service || {};
  const text = parts([typeName, resolvedCid || source.cid || source.name]).join(" - ");
  return text.slice(0, SUBJECT_MAX) || String(typeName || "").slice(0, SUBJECT_MAX);
}
