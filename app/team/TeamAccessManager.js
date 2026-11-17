"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import UserTableClient from "./UserTableClient";
import { isRosterEligibleUser } from "@/lib/schedules/protection";
import { SCHEDULE_FLAGS } from "@/lib/schedules/pola";
import styles from "./team.module.css";

const ROLE_PERMISSIONS = [
  { key: "view_all_tickets", label: "View All Tickets (Global Scope)" },
  { key: "manage_tickets", label: "Manage Tickets (Master Permission)" },
  { key: "create_tickets", label: "Create Tickets" },
  { key: "modify_tickets", label: "Modify Tickets (Status/Assign/Category)" },
  { key: "change_ticket_status", label: "Change Ticket Status (Open/Resolve)" },
  { key: "assign_tickets", label: "Assign Tickets (Staff/Tim/Priority)" },
  { key: "change_job_category", label: "Change Job Category & Score" },
  { key: "delete_tickets", label: "Delete Tickets" },
  { key: "edit_own_tickets", label: "Edit Tickets Created by Self" },
  { key: "edit_other_tickets", label: "Edit Tickets Created by Others" },
  { key: "manage_sla", label: "Manage SLA Configuration" },
  { key: "view_internal_notes", label: "View Internal Notes" },
  { key: "manage_ticket_notes", label: "Write Internal Notes" },
  { key: "view_live_ops", label: "View Live Operations Dashboard" },
  { key: "manage_users", label: "Manage Team & NOC Staff" },
  { key: "manage_roles", label: "Manage Security Roles & Permissions" },
  { key: "manage_departments", label: "Manage Sub-Departments & Routing" },
  { key: "manage_settings", label: "Manage Settings, Fields & Routing" },
  { key: "manage_trouble_master", label: "Manage Master Data Trouble" },
  { key: "manage_service_work", label: "Kelola Jenis Pekerjaan Layanan" },
  { key: "view_reports", label: "View Performance Analytics" },
  { key: "manage_schedules", label: "Manage Shift Schedules & Types" },
  { key: "manage_knowledge", label: "Manage Knowledge Base Articles" },
  { key: "manage_assets", label: "Manage Customer Assets & Services" },
  { key: "manage_meetings", label: "Manage Meetings & Attendance" },
];

export default function TeamAccessManager({
  users,
  roles,
  departments,
  locations = [],
  companies = ["ION", "SDC", "Sistercompany"],
  initialDeptMap = {},
  initialAutoRouteMap = {},
  currentUserId,
  canManageUsers = false,
  canManageRoles = false,
  canManageDepartments = false,
}) {
  const router = useRouter();
  const availableTabs = [
    canManageUsers && { id: "users", label: "Anggota Tim" },
    canManageRoles && { id: "roles", label: "Role & Hak Akses" },
    canManageDepartments && { id: "departments", label: "Departemen & Routing" },
  ].filter(Boolean);

  const [activeTab, setActiveTab] = useState(availableTabs[0]?.id || "users");
  const [newRole, setNewRole] = useState("");
  const [newDept, setNewDept] = useState("");

  const [userPage, setUserPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("active"); // active | eligible | resigned | all
  const [deptFilter, setDeptFilter] = useState("");
  const [userSort, setUserSort] = useState("name");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const userPageSize = 12;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    roleId: String(roles[0]?.id || ""),
    departmentId: String(departments[0]?.id || ""),
    locationId: "",
    scheduleFlag: "Umum",
    scheduleEligible: true,
  });

  const [editingRoleId, setEditingRoleId] = useState(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [editRolePermissions, setEditRolePermissions] = useState([]);

  const [editingDeptId, setEditingDeptId] = useState(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [editDeptCompany, setEditDeptCompany] = useState("");
  const [editDeptAutoRoute, setEditDeptAutoRoute] = useState("");
  const [deptCompanyMap, setDeptCompanyMap] = useState(initialDeptMap);
  const [deptAutoRouteMap, setDeptAutoRouteMap] = useState(initialAutoRouteMap);

  const activeUsersCount = users.filter((u) => u.active !== false).length;
  const shiftEligibleCount = users.filter(isRosterEligibleUser).length;
  const nonShiftCount = Math.max(0, activeUsersCount - shiftEligibleCount);
  const resignedCount = users.filter((u) => u.active === false).length;

  const handleAddRole = async (e) => {
    e.preventDefault();
    if (!newRole.trim()) return;
    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRole.trim() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Gagal menambah role");
      return;
    }
    toast.success("Role ditambahkan");
    setNewRole("");
    router.refresh();
  };

  const handleDeleteRole = async (id) => {
    if (!confirm("Hapus role ini? Role tidak bisa dihapus jika masih dipakai user.")) return;
    const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Gagal menghapus role");
      return;
    }
    toast.success("Role dihapus");
    router.refresh();
  };

  const handleAddDept = async (e) => {
    e.preventDefault();
    if (!newDept.trim()) return;
    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newDept.trim() }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Gagal menambah departemen");
      return;
    }
    toast.success("Departemen ditambahkan");
    setNewDept("");
    router.refresh();
  };

  const handleDeleteDept = async (id) => {
    if (!confirm("Hapus departemen ini? Gagal jika masih ada user atau tiket terkait.")) return;
    const res = await fetch(`/api/departments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Gagal menghapus departemen");
      return;
    }
    toast.success("Departemen dihapus");
    router.refresh();
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newUser,
          roleId: parseInt(newUser.roleId, 10),
          departmentId: parseInt(newUser.departmentId, 10),
          locationId: newUser.locationId ? parseInt(newUser.locationId, 10) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Gagal membuat user");
        return;
      }
      toast.success("Anggota baru berhasil dibuat");
      setNewUser((prev) => ({ ...prev, name: "", email: "", password: "" }));
      setShowCreateModal(false);
      router.refresh();
    } finally {
      setCreatingUser(false);
    }
  };

  const handleEditRole = (role) => {
    setEditingRoleId(role.id);
    setEditRoleName(role.name);
    setEditRolePermissions(role.permissions || []);
  };

  const handleToggleRolePermission = (perm) => {
    setEditRolePermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSaveRole = async (id) => {
    if (!editRoleName.trim()) return;
    const res = await fetch(`/api/roles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editRoleName, permissions: editRolePermissions }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Gagal menyimpan role");
      return;
    }
    toast.success("Role diperbarui");
    setEditingRoleId(null);
    router.refresh();
  };

  const handleEditDept = (dept) => {
    setEditingDeptId(dept.id);
    setEditDeptName(dept.name);
    setEditDeptCompany(deptCompanyMap[dept.id] || "");
    setEditDeptAutoRoute(deptAutoRouteMap[dept.id] || "");
  };

  const handleSaveDept = async (id) => {
    if (!editDeptName.trim()) return;
    const resDept = await fetch(`/api/departments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editDeptName.trim() }),
    });
    if (!resDept.ok) {
      const err = await resDept.json().catch(() => ({}));
      toast.error(err.error || "Gagal menyimpan departemen");
      return;
    }
    const resMap = await fetch("/api/settings/dept-routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentId: String(id),
        companyName: editDeptCompany,
        targetSupportDeptId: editDeptAutoRoute,
      }),
    });
    if (resMap.ok) {
      const mappedData = await resMap.json();
      setDeptCompanyMap(mappedData.deptCompanyMap);
      setDeptAutoRouteMap(mappedData.deptAutoRouteMap || {});
    }
    toast.success("Departemen diperbarui");
    setEditingDeptId(null);
    router.refresh();
  };

  const filteredUsers = users
    .filter((u) => {
      if (statusFilter === "active" && u.active === false) return false;
      if (statusFilter === "eligible" && !isRosterEligibleUser(u)) return false;
      if (statusFilter === "resigned" && u.active !== false) return false;

      const q = userSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q));
      const matchDept = !deptFilter || String(u.departmentId) === String(deptFilter);
      return matchSearch && matchDept;
    })
    .slice()
    .sort((a, b) => {
      if (userSort === "department") {
        const da = departments.find((d) => d.id === a.departmentId)?.name || "";
        const db = departments.find((d) => d.id === b.departmentId)?.name || "";
        const cmp = da.localeCompare(db, "id", { sensitivity: "base" });
        if (cmp !== 0) return cmp;
      } else if (userSort === "status") {
        const sa = a.active === false ? 2 : isRosterEligibleUser(a) ? 0 : 1;
        const sb = b.active === false ? 2 : isRosterEligibleUser(b) ? 0 : 1;
        if (sa !== sb) return sa - sb;
      }
      const na = a.name || a.email || "";
      const nb = b.name || b.email || "";
      return na.localeCompare(nb, "id", { sensitivity: "base" });
    });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / userPageSize));
  const safePage = Math.min(userPage, totalPages);

  return (
    <div className={styles.card}>
      <div className={styles.tabBar} role="tablist" aria-label="Menu Manajemen Tim">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.tabBody}>
        {activeTab === "users" && (
          <>
            <div className={styles.summaryGrid}>
              <button
                type="button"
                className={`${styles.summaryCard} ${statusFilter === "active" ? styles.summaryCardActive : ""}`}
                onClick={() => {
                  setStatusFilter("active");
                  setUserPage(1);
                }}
              >
                <span className={styles.summaryLabel}>Anggota Aktif</span>
                <span className={styles.summaryValue}>{activeUsersCount}</span>
              </button>
              <button
                type="button"
                className={`${styles.summaryCard} ${statusFilter === "eligible" ? styles.summaryCardActive : ""}`}
                onClick={() => {
                  setStatusFilter("eligible");
                  setUserPage(1);
                }}
              >
                <span className={styles.summaryLabel}>Ikut Roster Shift</span>
                <span className={styles.summaryValue}>{shiftEligibleCount}</span>
              </button>
              <button
                type="button"
                className={`${styles.summaryCard} ${statusFilter === "all" ? styles.summaryCardActive : ""}`}
                onClick={() => {
                  setStatusFilter("all");
                  setUserPage(1);
                }}
              >
                <span className={styles.summaryLabel}>Non-Shift / Manager</span>
                <span className={styles.summaryValue}>{nonShiftCount}</span>
              </button>
              <button
                type="button"
                className={`${styles.summaryCard} ${statusFilter === "resigned" ? styles.summaryCardActive : ""}`}
                onClick={() => {
                  setStatusFilter("resigned");
                  setUserPage(1);
                }}
              >
                <span className={styles.summaryLabel}>Resign / Nonaktif</span>
                <span className={styles.summaryValue}>{resignedCount}</span>
              </button>
            </div>

            <div className={styles.toolbar}>
              <div className={styles.toolbarLeft}>
                <h2 className={styles.sectionTitle}>Daftar Anggota</h2>
                <span className={styles.countPill}>{filteredUsers.length} orang</span>
              </div>
              <div className={styles.toolbarRight}>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className={styles.select}
                  aria-label="Filter status keaktifan"
                >
                  <option value="active">Status: Aktif</option>
                  <option value="eligible">Status: Aktif Shift</option>
                  <option value="resigned">Status: Resign / Nonaktif</option>
                  <option value="all">Status: Semua</option>
                </select>
                <select
                  value={deptFilter}
                  onChange={(e) => {
                    setDeptFilter(e.target.value);
                    setUserPage(1);
                  }}
                  className={styles.select}
                  aria-label="Filter departemen"
                >
                  <option value="">Semua Departemen</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <select
                  value={userSort}
                  onChange={(e) => {
                    setUserSort(e.target.value);
                    setUserPage(1);
                  }}
                  className={styles.select}
                  aria-label="Urutkan anggota"
                >
                  <option value="name">Urut: Nama A–Z</option>
                  <option value="department">Urut: Departemen</option>
                  <option value="status">Urut: Status Roster</option>
                </select>
                <input
                  type="search"
                  placeholder="Cari nama / email…"
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value);
                    setUserPage(1);
                  }}
                  className={`${styles.input} ${styles.searchInput}`}
                />
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => setShowCreateModal(true)}
                >
                  + Tambah Anggota
                </button>
              </div>
            </div>

            {filteredUsers.length > 0 ? (
              <>
                <UserTableClient
                  users={filteredUsers.slice(
                    (safePage - 1) * userPageSize,
                    safePage * userPageSize
                  )}
                  roles={roles}
                  departments={departments}
                  locations={locations}
                  currentUserId={currentUserId}
                />
                {filteredUsers.length > userPageSize && (
                  <div className={styles.pagination}>
                    <span className={styles.memberMeta}>
                      Menampilkan {(safePage - 1) * userPageSize + 1}–
                      {Math.min(safePage * userPageSize, filteredUsers.length)} dari{" "}
                      {filteredUsers.length} anggota
                    </span>
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        className={styles.btnSmall}
                        onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                      >
                        &laquo; Sebelumnya
                      </button>
                      <span className={styles.memberMeta}>
                        Hal {safePage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        className={styles.btnSmall}
                        onClick={() => setUserPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                      >
                        Berikutnya &raquo;
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.emptyState}>
                Tidak ada anggota yang cocok dengan filter saat ini.
              </div>
            )}
          </>
        )}

        {activeTab === "roles" && (
          <>
            <div className={styles.toolbar}>
              <h2 className={styles.sectionTitle}>Kelola Role & Hak Akses</h2>
              <form onSubmit={handleAddRole} className={styles.inlineForm}>
                <input
                  type="text"
                  placeholder="Nama Role Baru…"
                  required
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className={styles.input}
                />
                <button type="submit" className={styles.btnPrimary}>
                  + Tambah Role
                </button>
              </form>
            </div>

            <ul className={styles.listStack}>
              {roles.map((r) => {
                if (editingRoleId === r.id) {
                  const isAdminRole = r.name === "Admin";
                  return (
                    <li key={r.id} className={styles.listCard}>
                      <div className={styles.listCardTop}>
                        <input
                          type="text"
                          value={editRoleName}
                          onChange={(e) => setEditRoleName(e.target.value)}
                          className={styles.input}
                          style={{ flex: "1 1 220px" }}
                          placeholder="Nama Role"
                        />
                        <div className={styles.actionRow}>
                          <button
                            type="button"
                            onClick={() => handleSaveRole(r.id)}
                            className={styles.btnPrimary}
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRoleId(null)}
                            className={styles.btnSecondary}
                          >
                            Batal
                          </button>
                        </div>
                      </div>

                      {isAdminRole ? (
                        <div className={`${styles.alertBox} ${styles.alertInfo}`}>
                          Role Admin memiliki seluruh izin penuh secara permanen untuk mencegah terkuncinya akses sistem.
                        </div>
                      ) : (
                        <div className={styles.permGrid}>
                          {ROLE_PERMISSIONS.map((p) => (
                            <label key={p.key} className={styles.permItem}>
                              <input
                                type="checkbox"
                                checked={editRolePermissions.includes(p.key)}
                                onChange={() => handleToggleRolePermission(p.key)}
                              />
                              <span>{p.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                }

                const isSystemRole = ["Admin", "Manager", "User"].includes(r.name);
                const rolePerms = r.permissions || [];
                return (
                  <li key={r.id} className={styles.listCard}>
                    <div className={styles.listCardTop}>
                      <strong>{r.name}</strong>
                      <div className={styles.actionRow}>
                        <button
                          type="button"
                          className={styles.btnSmall}
                          onClick={() => handleEditRole(r)}
                        >
                          Edit & Izin
                        </button>
                        {!isSystemRole && (
                          <button
                            type="button"
                            className={styles.btnDangerOutline}
                            onClick={() => handleDeleteRole(r.id)}
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={styles.badgeRow}>
                      {rolePerms.length === 0 ? (
                        <span className={styles.memberMeta}>
                          Hak akses dasar staff saja (tanpa izin khusus).
                        </span>
                      ) : (
                        rolePerms.map((p) => (
                          <span key={p} className={styles.badge}>
                            {p.replace(/_/g, " ")}
                          </span>
                        ))
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {activeTab === "departments" && (
          <>
            <div className={styles.toolbar}>
              <h2 className={styles.sectionTitle}>Kelola Departemen & Routing Tiket</h2>
              <form onSubmit={handleAddDept} className={styles.inlineForm}>
                <input
                  type="text"
                  placeholder="Nama Departemen Baru…"
                  required
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  className={styles.input}
                />
                <button type="submit" className={styles.btnPrimary}>
                  + Tambah Departemen
                </button>
              </form>
            </div>

            <ul className={styles.listStack}>
              {departments.map((d) => {
                if (editingDeptId === d.id) {
                  return (
                    <li key={d.id} className={styles.listCard}>
                      <div className={styles.formGrid}>
                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>Nama Departemen</span>
                          <input
                            type="text"
                            value={editDeptName}
                            onChange={(e) => setEditDeptName(e.target.value)}
                            className={styles.input}
                          />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>Entitas Perusahaan</span>
                          <select
                            value={editDeptCompany}
                            onChange={(e) => setEditDeptCompany(e.target.value)}
                            className={styles.select}
                          >
                            <option value="">-- Tidak diatur --</option>
                            {companies.map((c, i) => (
                              <option key={i} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>Default Auto-Route Tiket</span>
                          <select
                            value={editDeptAutoRoute}
                            onChange={(e) => setEditDeptAutoRoute(e.target.value)}
                            className={styles.select}
                          >
                            <option value="">-- Tidak ada --</option>
                            {departments.map((tDept) => (
                              <option key={tDept.id} value={tDept.id}>
                                {tDept.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className={styles.modalFooter}>
                        <button
                          type="button"
                          onClick={() => setEditingDeptId(null)}
                          className={styles.btnSecondary}
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveDept(d.id)}
                          className={styles.btnPrimary}
                        >
                          Simpan
                        </button>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={d.id} className={styles.listCard}>
                    <div className={styles.listCardTop}>
                      <div className={styles.badgeRow}>
                        <strong>{d.name}</strong>
                        {deptCompanyMap[d.id] && (
                          <span className={styles.badge}>Entitas: {deptCompanyMap[d.id]}</span>
                        )}
                        {deptAutoRouteMap[d.id] && (
                          <span className={`${styles.badge} ${styles.badgeNonShift}`}>
                            Route →{" "}
                            {departments.find(
                              (x) => String(x.id) === String(deptAutoRouteMap[d.id])
                            )?.name || "Unknown"}
                          </span>
                        )}
                        <span className={styles.badge}>
                          Roster: {d.scheduleEnabled !== false ? d.schedulePola || "POLA_1" : "Skip"}
                        </span>
                      </div>
                      <div className={styles.actionRow}>
                        <button
                          type="button"
                          className={styles.btnSmall}
                          onClick={() => handleEditDept(d)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.btnDangerOutline}
                          onClick={() => handleDeleteDept(d.id)}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {showCreateModal && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-title"
          onClick={() => setShowCreateModal(false)}
        >
          <form
            className={styles.modalPanel}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAddUser}
          >
            <div>
              <h3 id="create-user-title" className={styles.modalTitle}>
                Tambah Anggota Baru
              </h3>
              <p className={styles.modalSubtitle}>
                Tentukan role, departemen, dan apakah user ikut jadwal shift POLA.
              </p>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Nama Lengkap</span>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className={styles.input}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Email</span>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className={styles.input}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Password Awal</span>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className={styles.input}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Role</span>
                <select
                  required
                  value={newUser.roleId}
                  onChange={(e) => {
                    const nextRole = roles.find((r) => String(r.id) === String(e.target.value));
                    setNewUser({
                      ...newUser,
                      roleId: e.target.value,
                      scheduleEligible: nextRole?.name === "Manager" ? false : true,
                    });
                  }}
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
                  required
                  value={newUser.departmentId}
                  onChange={(e) => setNewUser({ ...newUser, departmentId: e.target.value })}
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
                <span className={styles.fieldLabel}>Lokasi (opsional)</span>
                <select
                  value={newUser.locationId}
                  onChange={(e) => setNewUser({ ...newUser, locationId: e.target.value })}
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
                  value={newUser.scheduleFlag}
                  onChange={(e) => setNewUser({ ...newUser, scheduleFlag: e.target.value })}
                  className={styles.select}
                >
                  {SCHEDULE_FLAGS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>

              <label className={`${styles.checkboxRow} ${styles.fieldFull}`}>
                <input
                  type="checkbox"
                  checked={newUser.scheduleEligible}
                  onChange={(e) =>
                    setNewUser({ ...newUser, scheduleEligible: e.target.checked })
                  }
                />
                <span>Ikut generate roster shift (POLA)</span>
              </label>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setShowCreateModal(false)}
              >
                Batal
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={creatingUser}>
                {creatingUser ? "Menyimpan…" : "Buat Anggota"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
