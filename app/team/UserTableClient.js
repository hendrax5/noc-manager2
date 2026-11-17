"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { getRosterStatus } from "@/lib/schedules/protection";
import { SCHEDULE_FLAGS } from "@/lib/schedules/pola";
import styles from "./team.module.css";

function formatResignDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function todayIsoInput() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function UserTableClient({
  users,
  roles,
  departments,
  locations = [],
  currentUserId,
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    password: "",
    roleId: "",
    departmentId: "",
    locationId: "",
    scheduleFlag: "Umum",
    scheduleEligible: true,
  });

  const [offboardTarget, setOffboardTarget] = useState(null);
  const [offboardReason, setOffboardReason] = useState("Resign");
  const [offboardDate, setOffboardDate] = useState(todayIsoInput());
  const [cleanupFuture, setCleanupFuture] = useState(true);

  const openEditModal = (u) => {
    setEditingUser(u);
    setEditForm({
      name: u.name || "",
      email: u.email || "",
      password: "",
      roleId: String(u.roleId || ""),
      departmentId: String(u.departmentId || ""),
      locationId: u.locationId ? String(u.locationId) : "",
      scheduleFlag: u.scheduleFlag || "Umum",
      scheduleEligible: u.scheduleEligible !== false,
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setBusyId(editingUser.id);
    try {
      const payload = {
        name: editForm.name,
        email: editForm.email,
        roleId: parseInt(editForm.roleId, 10),
        departmentId: parseInt(editForm.departmentId, 10),
        locationId: editForm.locationId ? parseInt(editForm.locationId, 10) : null,
        scheduleFlag: editForm.scheduleFlag,
        scheduleEligible: editForm.scheduleEligible,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menyimpan perubahan user");
        return;
      }
      toast.success("Data anggota diperbarui");
      setEditingUser(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const openOffboardModal = (u) => {
    setOffboardTarget(u);
    setOffboardReason(u.inactiveReason || "Resign");
    setOffboardDate(todayIsoInput());
    setCleanupFuture(true);
  };

  const handleConfirmResign = async (e) => {
    e.preventDefault();
    if (!offboardTarget) return;
    setBusyId(offboardTarget.id);
    try {
      const res = await fetch(`/api/users/${offboardTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: false,
          resignedAt: offboardDate,
          inactiveReason: offboardReason.trim() || "Resign",
          cleanupFutureSchedules: cleanupFuture,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal menonaktifkan user");
        return;
      }
      const extra =
        data.cleanedFutureSchedules > 0
          ? ` (${data.cleanedFutureSchedules} sel jadwal mendatang dibersihkan)`
          : "";
      toast.success(`${offboardTarget.name || offboardTarget.email} ditandai resign/nonaktif${extra}`);
      setOffboardTarget(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleReactivate = async (u) => {
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal mengaktifkan kembali user");
        return;
      }
      toast.success(`${u.name || u.email} diaktifkan kembali`);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!offboardTarget) return;
    setBusyId(offboardTarget.id);
    try {
      const res = await fetch(`/api/users/${offboardTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Gagal menghapus user");
        return;
      }
      toast.success("Akun dihapus permanen");
      setOffboardTarget(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Anggota</th>
              <th>Role & Departemen</th>
              <th>Status Roster & Akun</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const roster = getRosterStatus(u);
              const isSelf = Number(u.id) === Number(currentUserId);
              const isResigned = u.active === false;
              const roleName = u.role?.name || roles.find((r) => r.id === u.roleId)?.name || "-";
              const deptName =
                u.department?.name ||
                departments.find((d) => d.id === u.departmentId)?.name ||
                "-";
              const locName =
                u.location?.city ||
                locations.find((l) => l.id === u.locationId)?.city ||
                null;

              return (
                <tr
                  key={u.id}
                  className={isResigned ? styles.rowInactive : undefined}
                  style={{ opacity: busyId === u.id ? 0.55 : 1 }}
                >
                  <td>
                    <div className={styles.memberName}>{u.name || "Staff User"}</div>
                    <div className={styles.memberMeta}>
                      {u.email}
                      {locName ? ` · ${locName}` : ""}
                    </div>
                  </td>

                  <td>
                    <div className={styles.badgeRow}>
                      <span className={styles.badge}>{roleName}</span>
                      <span className={styles.badge}>{deptName}</span>
                      {u.scheduleFlag && u.scheduleFlag !== "Umum" && (
                        <span className={styles.badge}>{u.scheduleFlag}</span>
                      )}
                    </div>
                  </td>

                  <td>
                    <div className={styles.badgeRow}>
                      <span
                        className={`${styles.badge} ${
                          roster.code === "eligible"
                            ? styles.badgeEligible
                            : roster.code === "resigned"
                              ? styles.badgeResigned
                              : styles.badgeNonShift
                        }`}
                      >
                        {roster.label}
                      </span>
                    </div>
                    {isResigned && (
                      <div className={styles.memberMeta}>
                        {u.inactiveReason || "Resign"}
                        {u.resignedAt ? ` · ${formatResignDate(u.resignedAt)}` : ""}
                      </div>
                    )}
                  </td>

                  <td>
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        className={styles.btnSmall}
                        onClick={() => openEditModal(u)}
                        disabled={busyId === u.id}
                      >
                        Edit
                      </button>
                      {isResigned ? (
                        <button
                          type="button"
                          className={styles.btnSuccessOutline}
                          onClick={() => handleReactivate(u)}
                          disabled={busyId === u.id}
                        >
                          Aktifkan Lagi
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.btnDangerOutline}
                          onClick={() => openOffboardModal(u)}
                          disabled={busyId === u.id || isSelf}
                          title={
                            isSelf
                              ? "Tidak dapat menonaktifkan akun sendiri"
                              : "Tandai resign / nonaktif"
                          }
                        >
                          Tandai Resign
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
          onClick={() => setEditingUser(null)}
        >
          <form
            className={styles.modalPanel}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveEdit}
          >
            <div>
              <h3 id="edit-user-title" className={styles.modalTitle}>
                Edit Anggota
              </h3>
              <p className={styles.modalSubtitle}>{editingUser.email}</p>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Nama Lengkap</span>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={styles.input}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Email</span>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className={styles.input}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Role</span>
                <select
                  value={editForm.roleId}
                  onChange={(e) => setEditForm({ ...editForm, roleId: e.target.value })}
                  className={styles.select}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Departemen</span>
                <select
                  value={editForm.departmentId}
                  onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}
                  className={styles.select}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Lokasi</span>
                <select
                  value={editForm.locationId}
                  onChange={(e) => setEditForm({ ...editForm, locationId: e.target.value })}
                  className={styles.select}
                >
                  <option value="">-- Tanpa Lokasi --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.city}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Flag Jadwal</span>
                <select
                  value={editForm.scheduleFlag}
                  onChange={(e) => setEditForm({ ...editForm, scheduleFlag: e.target.value })}
                  className={styles.select}
                >
                  {SCHEDULE_FLAGS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>

              <label className={`${styles.field} ${styles.fieldFull}`}>
                <span className={styles.fieldLabel}>Reset Password (opsional)</span>
                <input
                  type="password"
                  placeholder="Biarkan kosong jika tidak diganti"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className={styles.input}
                />
              </label>

              <label className={`${styles.checkboxRow} ${styles.fieldFull}`}>
                <input
                  type="checkbox"
                  checked={editForm.scheduleEligible}
                  disabled={editingUser.active === false}
                  onChange={(e) =>
                    setEditForm({ ...editForm, scheduleEligible: e.target.checked })
                  }
                />
                <span>
                  <strong>Ikut Roster Shift (Generate POLA)</strong> — Nonaktifkan untuk staff
                  kantor/non-shift agar tidak masuk hitungan solver jadwal.
                </span>
              </label>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setEditingUser(null)}
              >
                Batal
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={busyId === editingUser.id}>
                {busyId === editingUser.id ? "Menyimpan…" : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {offboardTarget && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="offboard-user-title"
          onClick={() => setOffboardTarget(null)}
        >
          <form
            className={styles.modalPanel}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleConfirmResign}
          >
            <div>
              <h3 id="offboard-user-title" className={styles.modalTitle}>
                Tandai Anggota Resign / Nonaktif
              </h3>
              <p className={styles.modalSubtitle}>
                {offboardTarget.name || offboardTarget.email} ({offboardTarget.email})
              </p>
            </div>

            <div className={`${styles.alertBox} ${styles.alertWarning}`}>
              Riwayat tiket, komentar, laporan, dan jadwal bulan lalu tetap aman tersimpan.
              Setelah dinonaktifkan, akun tidak dapat login, tidak menerima auto-assign tiket,
              dan <strong>otomatis dikeluarkan dari generate roster bulan berikutnya</strong>.
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Tanggal Efektif Keluar</span>
                <input
                  type="date"
                  required
                  value={offboardDate}
                  onChange={(e) => setOffboardDate(e.target.value)}
                  className={styles.input}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Keterangan</span>
                <input
                  type="text"
                  value={offboardReason}
                  onChange={(e) => setOffboardReason(e.target.value)}
                  placeholder="Resign / Mutasi / Selesai Kontrak"
                  className={styles.input}
                />
              </label>

              <label className={`${styles.checkboxRow} ${styles.fieldFull}`}>
                <input
                  type="checkbox"
                  checked={cleanupFuture}
                  onChange={(e) => setCleanupFuture(e.target.checked)}
                />
                <span>
                  Bersihkan jadwal otomatis setelah tanggal keluar (sel editan manual / lembur /
                  catatan tetap dipertahankan).
                </span>
              </label>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setOffboardTarget(null)}
              >
                Batal
              </button>
              <button
                type="submit"
                className={styles.btnDangerOutline}
                style={{ height: "var(--ui-control-height)", padding: "0 var(--ui-space-4)" }}
                disabled={busyId === offboardTarget.id}
              >
                {busyId === offboardTarget.id ? "Memproses…" : "Konfirmasi Nonaktif / Resign"}
              </button>
            </div>

            <div className={styles.dangerZone}>
              <span className={styles.memberMeta}>
                Hapus permanen hanya untuk akun salah input tanpa histori.
              </span>
              <button
                type="button"
                className={styles.btnSmall}
                onClick={handlePermanentDelete}
                disabled={busyId === offboardTarget.id}
              >
                Hapus Permanen
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
