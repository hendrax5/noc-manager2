import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { attachmentDiskName, driveFolderName, resolveUploadPath } from "./driveSync.js";

test("recognises local upload URLs only", () => {
  assert.equal(attachmentDiskName("/api/uploads/1793023144268-Laporan_Aktivasi_IPT_RAJASA.pdf"), "1793023144268-Laporan_Aktivasi_IPT_RAJASA.pdf");
  assert.equal(attachmentDiskName("/api/uploads/abc.png?x=1"), "abc.png");
  assert.equal(attachmentDiskName("https://drive.google.com/file/d/1/view"), null);
  assert.equal(attachmentDiskName("/api/uploads/"), null);
  assert.equal(attachmentDiskName(null), null);
});

test("resolved paths stay inside public/uploads", () => {
  const base = path.resolve("C:/work/app");
  assert.equal(
    resolveUploadPath("/api/uploads/abc.pdf", base),
    path.resolve(base, "public", "uploads", "abc.pdf")
  );
  assert.equal(resolveUploadPath("/api/uploads/..%2F..%2Fetc%2Fpasswd", base), null);
  assert.equal(resolveUploadPath("/api/uploads/a%2Fb.pdf", base), null);
  assert.equal(resolveUploadPath("https://example.com/x.pdf", base), null);
});

test("ticket folder name follows the tracking id", () => {
  assert.equal(driveFolderName({ id: 45976, trackingId: "HSK-N44G-8OLE" }), "HSK-N44G-8OLE");
  assert.equal(driveFolderName({ id: 7 }), "ticket-7");
  assert.equal(driveFolderName(null), "ticket-unknown");
});
