import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";

import {
  buildMultipartBody,
  buildServiceAccountJwt,
  checkDriveAccess,
  driveConfig,
  driveFileName,
  ensureDriveFolder,
  folderQuery,
  getDriveToken,
  isDriveConfigured,
  mimeTypeForFilename,
  readDriveConfig,
  resetDriveCache,
  uploadDriveFile,
} from "./gdrive.js";

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const account = { client_email: "svc@example.com", private_key: privateKey };

function decodePart(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

test("reads service-account config from base64 and repairs escaped newlines", () => {
  const raw = JSON.stringify({ client_email: "svc@example.com", private_key: "line1\\nline2" });
  const config = readDriveConfig({
    GDRIVE_FOLDER_ID: "folder-1",
    GDRIVE_SERVICE_ACCOUNT_B64: Buffer.from(raw).toString("base64"),
  });
  assert.equal(config.mode, "service_account");
  assert.equal(config.folderId, "folder-1");
  assert.equal(config.account.client_email, "svc@example.com");
  assert.equal(config.account.private_key, "line1\nline2");
  assert.equal(isDriveConfigured(config), true);
});

test("configuration is never considered ready without folder or credentials", () => {
  assert.equal(isDriveConfigured(readDriveConfig({})), false);
  assert.equal(isDriveConfigured(readDriveConfig({ GDRIVE_FOLDER_ID: "f" })), false);
  assert.equal(
    isDriveConfigured(readDriveConfig({ GDRIVE_MODE: "oauth", GDRIVE_FOLDER_ID: "f", GDRIVE_CLIENT_ID: "id" })),
    false
  );
  assert.equal(
    isDriveConfigured(
      readDriveConfig({
        GDRIVE_MODE: "oauth",
        GDRIVE_FOLDER_ID: "f",
        GDRIVE_CLIENT_ID: "id",
        GDRIVE_CLIENT_SECRET: "secret",
        GDRIVE_REFRESH_TOKEN: "refresh",
      })
    ),
    true
  );
  assert.equal(driveConfig().mode, "service_account"); // memoized default env read
  resetDriveCache();
});

test("service-account JWT is RS256 and carries scope/audience/impersonation", () => {
  const jwt = buildServiceAccountJwt({
    account,
    impersonate: "noc@example.com",
    aud: "https://oauth2.googleapis.com/token",
    now: 1_700_000_000_000,
  });
  const [headerPart, payloadPart, signaturePart] = jwt.split(".");
  const header = decodePart(headerPart);
  const payload = decodePart(payloadPart);
  assert.equal(header.alg, "RS256");
  assert.equal(header.typ, "JWT");
  assert.equal(payload.iss, "svc@example.com");
  assert.equal(payload.sub, "noc@example.com");
  assert.equal(payload.aud, "https://oauth2.googleapis.com/token");
  assert.equal(payload.iat, 1_700_000_000);
  assert.equal(payload.exp, 1_700_003_600);
  assert.match(payload.scope, /auth\/drive$/);
  assert.ok(
    crypto.verify("sha256", Buffer.from(`${headerPart}.${payloadPart}`), publicKey, Buffer.from(signaturePart, "base64url"))
  );
});

test("mime types and Drive file names are safe", () => {
  assert.equal(mimeTypeForFilename("laporan.pdf"), "application/pdf");
  assert.equal(mimeTypeForFilename("foto.PNG"), "image/png");
  assert.equal(mimeTypeForFilename("data.unknownext"), "application/octet-stream");
  assert.equal(mimeTypeForFilename("noext"), "application/octet-stream");
  assert.equal(driveFileName("HSK-N44G-8OLE", "Laporan: Aktivasi/IP T.pdf"), "HSK-N44G-8OLE - Laporan_ Aktivasi_IP T.pdf");
  assert.equal(driveFileName(null, "a.docx"), "a.docx");
});

test("folder query escapes quotes and targets the parent", () => {
  const query = folderQuery("O'Brien ops", "parent-1");
  assert.ok(query.includes("name='O\\'Brien ops'"));
  assert.ok(query.includes("'parent-1' in parents"));
  assert.ok(query.includes("mimeType='application/vnd.google-apps.folder'"));
  assert.ok(query.includes("trashed=false"));
});

test("multipart body has metadata, media type, bytes and closing boundary", () => {
  const boundary = "boundary-123";
  const buffer = Buffer.from("PDFDATA");
  const body = buildMultipartBody({
    boundary,
    metadata: { name: "HSK-1 - laporan.pdf", parents: ["folder-1"] },
    mimeType: "application/pdf",
    buffer,
  });
  const text = body.toString("latin1");
  assert.ok(text.startsWith(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`));
  assert.ok(text.includes('{"name":"HSK-1 - laporan.pdf","parents":["folder-1"]}'));
  assert.ok(text.includes(`\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\nPDFDATA`));
  assert.ok(text.endsWith(`\r\n--${boundary}--\r\n`));
});

test("preflight rejects unconfigured Drive", async () => {
  await assert.rejects(() => checkDriveAccess({ config: readDriveConfig({}) }), /belum dikonfigurasi/);
});

test("uploads into a per-ticket folder against a mock Drive endpoint", async () => {
  resetDriveCache();
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, body });
      if (req.url === "/token" && req.method === "POST") {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ access_token: "test-token", expires_in: 3600 }));
      } else if (req.method === "GET" && req.url.startsWith("/drive/v3/files?")) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ files: [] }));
      } else if (req.method === "GET" && req.url.startsWith("/drive/v3/files/root-folder?")) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ id: "root-folder", name: "NOC Archive", mimeType: "application/vnd.google-apps.folder" }));
      } else if (req.method === "POST" && req.url.startsWith("/drive/v3/files?")) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ id: "folder-9" }));
      } else if (req.method === "POST" && req.url.startsWith("/upload/drive/v3/files?")) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ id: "file-9", name: "HSK-N44G-8OLE - laporan.pdf", webViewLink: "https://drive.google.com/file/d/file-9/view" }));
      } else {
        res.statusCode = 404;
        res.end("{}");
      }
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const config = {
      mode: "service_account",
      folderId: "root-folder",
      sharedDriveId: "",
      tokenUrl: `${base}/token`,
      apiBase: base,
      account,
      impersonate: "",
    };
    assert.equal(await getDriveToken({ config }), "test-token");
    assert.equal(await getDriveToken({ config }), "test-token"); // cached
    const folderId = await ensureDriveFolder("HSK-N44G-8OLE", "root-folder", { config });
    assert.equal(folderId, "folder-9");
    const uploaded = await uploadDriveFile({
      name: "HSK-N44G-8OLE - laporan.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("PDFDATA"),
      folderName: "HSK-N44G-8OLE",
      config,
    });
    assert.deepEqual(uploaded, {
      id: "file-9",
      webViewLink: "https://drive.google.com/file/d/file-9/view",
      folderId: "folder-9",
    });
    const tokenCalls = requests.filter((request) => request.url === "/token");
    assert.equal(tokenCalls.length, 1);
    assert.equal(tokenCalls[0].body.includes("grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer"), true);
    const uploadCall = requests.find((request) => request.url.startsWith("/upload/drive/v3/files?"));
    assert.match(uploadCall.auth, /^Bearer test-token$/);
    assert.ok(uploadCall.body.includes("HSK-N44G-8OLE - laporan.pdf"));
    assert.ok(uploadCall.body.includes("PDFDATA"));
    assert.ok(uploadCall.url.includes("supportsAllDrives=true"));

    const access = await checkDriveAccess({ config });
    assert.deepEqual(access, {
      ok: true,
      folderId: "root-folder",
      folderName: "NOC Archive",
      folderMimeType: "application/vnd.google-apps.folder",
      account: "svc@example.com",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    resetDriveCache();
  }
});
