/**
 * Google Drive archiving for ticket attachments. Server-only.
 *
 * Configuration comes from env (see docs/GOOGLE_DRIVE.md):
 *   GDRIVE_FOLDER_ID                destination folder id (required)
 *   GDRIVE_SHARED_DRIVE_ID          optional shared drive id (folder inside a Shared Drive)
 *   GDRIVE_MODE                     "service_account" (default) or "oauth"
 *   GDRIVE_SERVICE_ACCOUNT_B64      base64 service-account JSON (or GDRIVE_SERVICE_ACCOUNT_JSON)
 *   GDRIVE_IMPERSONATE              optional Workspace user for domain-wide delegation
 *   GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET / GDRIVE_REFRESH_TOKEN   OAuth mode
 *   GDRIVE_TOKEN_URL / GDRIVE_API_BASE                                optional test overrides
 *
 * No googleapis dependency: the token request and multipart upload use fetch + node:crypto.
 */
import crypto from "node:crypto";

const DEFAULT_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_API_BASE = "https://www.googleapis.com";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
export const FOLDER_MIME = "application/vnd.google-apps.folder";

const MIME_BY_EXT = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};

let cachedConfig;
let cachedToken = null;

/** Test hook: forget the memoized config and access token. */
export function resetDriveCache() {
  cachedConfig = undefined;
  cachedToken = null;
}

export function readDriveConfig(env = process.env) {
  const mode = String(env.GDRIVE_MODE || "service_account").trim().toLowerCase();
  const base = {
    mode,
    folderId: String(env.GDRIVE_FOLDER_ID || "").trim(),
    sharedDriveId: String(env.GDRIVE_SHARED_DRIVE_ID || "").trim(),
    tokenUrl: String(env.GDRIVE_TOKEN_URL || DEFAULT_TOKEN_URL).trim(),
    apiBase: String(env.GDRIVE_API_BASE || DEFAULT_API_BASE).trim().replace(/\/+$/, ""),
  };

  if (mode === "oauth") {
    return {
      ...base,
      clientId: String(env.GDRIVE_CLIENT_ID || "").trim(),
      clientSecret: String(env.GDRIVE_CLIENT_SECRET || "").trim(),
      refreshToken: String(env.GDRIVE_REFRESH_TOKEN || "").trim(),
    };
  }

  let raw = String(env.GDRIVE_SERVICE_ACCOUNT_JSON || "").trim();
  const encoded = String(env.GDRIVE_SERVICE_ACCOUNT_B64 || "").trim();
  if (!raw && encoded) {
    try {
      raw = Buffer.from(encoded, "base64").toString("utf8");
    } catch {
      raw = "";
    }
  }
  let account = null;
  if (raw) {
    try {
      account = JSON.parse(raw);
    } catch {
      account = null;
    }
  }
  if (account && typeof account.private_key === "string") {
    // Some deployments store the JSON with literal "\n" inside the PEM.
    account = { ...account, private_key: account.private_key.replace(/\\n/g, "\n") };
  }
  return { ...base, account, impersonate: String(env.GDRIVE_IMPERSONATE || "").trim() };
}

export function driveConfig() {
  if (cachedConfig === undefined) cachedConfig = readDriveConfig();
  return cachedConfig;
}

export function isDriveConfigured(config = driveConfig()) {
  if (!config || !config.folderId) return false;
  if (config.mode === "oauth") {
    return Boolean(config.clientId && config.clientSecret && config.refreshToken);
  }
  return Boolean(config.account?.client_email && config.account?.private_key);
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

/** Signed JWT assertion for the service-account token exchange. */
export function buildServiceAccountJwt({ account, impersonate = "", scope = DRIVE_SCOPE, aud, now = Date.now() }) {
  if (!account?.client_email || !account?.private_key) throw new Error("Service account Google Drive belum lengkap.");
  const issuedAt = Math.floor(now / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: account.client_email,
    scope,
    aud,
    iat: issuedAt,
    exp: issuedAt + 3600,
    ...(impersonate ? { sub: impersonate } : {}),
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.sign("sha256", Buffer.from(signingInput), account.private_key).toString("base64url");
  return `${signingInput}.${signature}`;
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!res.ok) {
    const reason = data.error_description || data.error?.message || data.error || text.slice(0, 200);
    const error = new Error(`Google Drive ${res.status}: ${reason}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function getDriveToken({ config = driveConfig(), force = false } = {}) {
  if (!isDriveConfigured(config)) throw new Error("Google Drive belum dikonfigurasi (folder + kredensial).");
  if (!force && cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.accessToken;

  const form = new URLSearchParams();
  if (config.mode === "oauth") {
    form.set("grant_type", "refresh_token");
    form.set("client_id", config.clientId);
    form.set("client_secret", config.clientSecret);
    form.set("refresh_token", config.refreshToken);
  } else {
    form.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
    form.set(
      "assertion",
      buildServiceAccountJwt({ account: config.account, impersonate: config.impersonate, aud: config.tokenUrl })
    );
  }

  const data = await fetchJson(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
  return cachedToken.accessToken;
}

/** Read-only preflight: token exchange + destination folder access. */
export async function checkDriveAccess({ config = driveConfig(), folderId = config.folderId } = {}) {
  if (!isDriveConfigured(config)) throw new Error("Google Drive belum dikonfigurasi (folder + kredensial).");
  if (!folderId) throw new Error("GDRIVE_FOLDER_ID belum diisi.");
  const token = await getDriveToken({ config });
  const params = new URLSearchParams({ fields: "id,name,mimeType", supportsAllDrives: "true" });
  const folder = await fetchJson(`${config.apiBase}/drive/v3/files/${encodeURIComponent(folderId)}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    ok: true,
    folderId: folder.id,
    folderName: folder.name,
    folderMimeType: folder.mimeType,
    account: config.mode === "oauth" ? "oauth" : config.account?.client_email || null,
  };
}

/** Drive query that finds a folder by name under a parent. */
export function folderQuery(name, parentId) {
  const escaped = String(name).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `name='${escaped}' and mimeType='${FOLDER_MIME}' and '${parentId}' in parents and trashed=false`;
}

export async function ensureDriveFolder(name, parentId = driveConfig().folderId, { config = driveConfig(), token } = {}) {
  if (!parentId) throw new Error("GDRIVE_FOLDER_ID belum diisi.");
  const accessToken = token || (await getDriveToken({ config }));
  const headers = { Authorization: `Bearer ${accessToken}` };

  const params = new URLSearchParams({
    q: folderQuery(name, parentId),
    fields: "files(id,name)",
    pageSize: "1",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const found = await fetchJson(`${config.apiBase}/drive/v3/files?${params}`, { headers });
  if (found.files?.[0]?.id) return found.files[0].id;

  const created = await fetchJson(
    `${config.apiBase}/drive/v3/files?supportsAllDrives=true&fields=id`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    }
  );
  return created.id;
}

/** multipart/related body: JSON metadata part, then the binary part. */
export function buildMultipartBody({ boundary, metadata, mimeType, buffer }) {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}` +
        `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

export function mimeTypeForFilename(filename) {
  const ext = String(filename || "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

export function driveFileName(trackingId, filename) {
  const clean = String(filename || "attachment")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
    .trim()
    .slice(0, 200) || "attachment";
  return trackingId ? `${trackingId} - ${clean}` : clean;
}

/** Ensure the per-ticket folder and upload one file. Returns { id, webViewLink, folderId }. */
export async function uploadDriveFile({ name, mimeType, buffer, folderName, config = driveConfig() }) {
  const token = await getDriveToken({ config });
  const folderId = await ensureDriveFolder(folderName, config.folderId, { config, token });
  const boundary = `nocdrive_${Date.now().toString(36)}_${crypto.randomBytes(8).toString("hex")}`;
  const metadata = { name, parents: [folderId] };
  const body = buildMultipartBody({ boundary, metadata, mimeType, buffer });

  const uploaded = await fetchJson(
    `${config.apiBase}/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  return { id: uploaded.id, webViewLink: uploaded.webViewLink || null, folderId };
}
