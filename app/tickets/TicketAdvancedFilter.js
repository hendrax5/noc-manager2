"use client";
import { WORK_TYPES, WORK_TYPE_LABELS } from "@/lib/tickets/workClassification";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { TICKET_STATUSES, DEFAULT_FILTER_STATUSES } from "@/lib/tickets/status";
import styles from "./ticket-list.module.css";

function isSameList(a, b) {
  return a.length === b.length && a.every((item) => b.includes(item));
}

export default function TicketAdvancedFilter({
  companies = ["ION", "SDC", "Sistercompany"],
  initialCompanyParam = "",
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") || "");
  const [statuses, setStatuses] = useState(
    searchParams.get("statuses")
      ? searchParams.get("statuses").split(",")
      : [...DEFAULT_FILTER_STATUSES]
  );
  const [assignments, setAssignments] = useState(
    searchParams.get("assignments")
      ? searchParams.get("assignments").split(",")
      : ["me", "unassigned", "others"]
  );
  const [allDepts, setAllDepts] = useState(searchParams.get("all_depts") === "true");
  const [companyParam, setCompanyParam] = useState(
    searchParams.get("company") !== null ? searchParams.get("company") : initialCompanyParam
  );
  const [jobCategoryParam, setJobCategoryParam] = useState(searchParams.get("jobCategory") || "");
  const [workType, setWorkType] = useState(searchParams.get("workType") || "");
  const [jobCategories, setJobCategories] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const ALL_STATUSES = [...TICKET_STATUSES];

  useEffect(() => {
    fetch("/api/settings/job-categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setJobCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setWorkType(searchParams.get("workType") || "");
    setQ(searchParams.get("q") || "");
    setStatuses(
      searchParams.get("statuses")
        ? searchParams.get("statuses").split(",")
        : [...DEFAULT_FILTER_STATUSES]
    );
    setAssignments(
      searchParams.get("assignments")
        ? searchParams.get("assignments").split(",")
        : ["me", "unassigned", "others"]
    );
    setAllDepts(searchParams.get("all_depts") === "true");
    setCompanyParam(
      searchParams.get("company") !== null ? searchParams.get("company") : initialCompanyParam
    );
    setJobCategoryParam(searchParams.get("jobCategory") || "");
  }, [searchParams, initialCompanyParam]);

  const navigateWith = (overrides = {}) => {
    const nextQ = overrides.q !== undefined ? overrides.q : q;
    const nextWorkType = overrides.workType !== undefined ? overrides.workType : workType;
    const nextStatuses = overrides.statuses !== undefined ? overrides.statuses : statuses;
    const nextAssignments =
      overrides.assignments !== undefined ? overrides.assignments : assignments;
    const nextAllDepts = overrides.allDepts !== undefined ? overrides.allDepts : allDepts;
    const nextCompany = overrides.company !== undefined ? overrides.company : companyParam;
    const nextJobCategory =
      overrides.jobCategory !== undefined ? overrides.jobCategory : jobCategoryParam;

    const params = new URLSearchParams();
    if (searchParams.get("view") === "installation" && !nextWorkType) {
      params.set("view", "installation");
    }
    if (nextWorkType) params.set("workType", nextWorkType);
    if (searchParams.get("serviceWorkTypeId") && nextWorkType === "ServiceWork") {
      params.set("serviceWorkTypeId", searchParams.get("serviceWorkTypeId"));
    }
    if (searchParams.get("date")) params.set("date", searchParams.get("date"));
    if (nextQ) params.set("q", nextQ);
    if (nextStatuses.length > 0 && !isSameList(nextStatuses, DEFAULT_FILTER_STATUSES)) {
      params.set("statuses", nextStatuses.join(","));
    } else if (nextStatuses.length === 0) {
      params.set("statuses", "");
    }
    if (nextAssignments.length > 0 && nextAssignments.length < 3) {
      params.set("assignments", nextAssignments.join(","));
    }
    if (nextAllDepts) params.set("all_depts", "true");
    if (nextCompany) params.set("company", nextCompany);
    if (nextJobCategory) params.set("jobCategory", nextJobCategory);
    if (searchParams.get("limit")) params.set("limit", searchParams.get("limit"));
    if (searchParams.get("tab")) params.set("tab", searchParams.get("tab"));

    const qs = params.toString();
    router.push(qs ? `/tickets?${qs}` : "/tickets");
  };

  const toggleAssignment = (val) => {
    setAssignments((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );
  };

  const toggleStatus = (st) => {
    setStatuses((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
    );
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    navigateWith();
  };

  const clearAll = () => {
    setWorkType("");
    setQ("");
    setStatuses([...DEFAULT_FILTER_STATUSES]);
    setAssignments(["me", "unassigned", "others"]);
    setAllDepts(false);
    setCompanyParam("");
    setJobCategoryParam("");
    setDrawerOpen(false);

    const params = new URLSearchParams();
    if (searchParams.get("limit")) params.set("limit", searchParams.get("limit"));
    if (searchParams.get("tab")) params.set("tab", searchParams.get("tab"));
    router.push(params.toString() ? `/tickets?${params.toString()}` : "/tickets");
  };

  const activeChips = [];
  if (workType) {
    activeChips.push({
      key: "workType",
      label: `Klasifikasi: ${WORK_TYPE_LABELS[workType] || workType}`,
      onDismiss: () => {
        setWorkType("");
        navigateWith({ workType: "" });
      },
    });
  }
  if (jobCategoryParam) {
    activeChips.push({
      key: "jobCategory",
      label: `Kategori: ${jobCategoryParam}`,
      onDismiss: () => {
        setJobCategoryParam("");
        navigateWith({ jobCategory: "" });
      },
    });
  }
  if (companyParam) {
    activeChips.push({
      key: "company",
      label: `Company: ${companyParam}`,
      onDismiss: () => {
        setCompanyParam("");
        navigateWith({ company: "" });
      },
    });
  }
  if (allDepts) {
    activeChips.push({
      key: "allDepts",
      label: "Semua Departemen",
      onDismiss: () => {
        setAllDepts(false);
        navigateWith({ allDepts: false });
      },
    });
  }
  if (assignments.length < 3) {
    activeChips.push({
      key: "assignments",
      label: `Assignment: ${assignments.length ? assignments.join(", ") : "kosong"}`,
      onDismiss: () => {
        const next = ["me", "unassigned", "others"];
        setAssignments(next);
        navigateWith({ assignments: next });
      },
    });
  }
  if (!isSameList(statuses, DEFAULT_FILTER_STATUSES)) {
    activeChips.push({
      key: "statuses",
      label: `Status: ${statuses.length} dipilih`,
      onDismiss: () => {
        const next = [...DEFAULT_FILTER_STATUSES];
        setStatuses(next);
        navigateWith({ statuses: next });
      },
    });
  }

  return (
    <section className={styles.toolbarCard} aria-label="Filter tiket">
      <form onSubmit={handleSearch} className={styles.toolbarForm}>
        <input
          type="text"
          aria-label="Find a ticket"
          placeholder="Search by Tracking ID, Subject, Name, SAP, or CID..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={styles.searchInput}
        />

        <select
          id="ticket-work-type"
          aria-label="Klasifikasi pekerjaan"
          value={workType}
          onChange={(e) => {
            const val = e.target.value;
            setWorkType(val);
            navigateWith({ workType: val });
          }}
          className={styles.quickSelect}
        >
          <option value="">Klasifikasi: Semua</option>
          {WORK_TYPES.map((value) => (
            <option key={value} value={value}>
              {WORK_TYPE_LABELS[value]}
            </option>
          ))}
        </select>

        <select
          aria-label="Job Category"
          value={jobCategoryParam}
          onChange={(e) => {
            const val = e.target.value;
            setJobCategoryParam(val);
            navigateWith({ jobCategory: val });
          }}
          className={styles.quickSelect}
        >
          <option value="">-- All Categories --</option>
          {jobCategories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Company Routing"
          value={companyParam}
          onChange={(e) => {
            const val = e.target.value;
            setCompanyParam(val);
            navigateWith({ company: val });
          }}
          className={styles.quickSelect}
        >
          <option value="">-- All Companies --</option>
          {companies.map((c, i) => (
            <option key={`filter-${i}`} value={c}>
              {c}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((prev) => !prev)}
          className={`${styles.popoverToggle} ${drawerOpen ? styles.popoverToggleActive : ""}`}
        >
          <span>Filter Status &amp; PIC ({statuses.length})</span>
          <span aria-hidden="true">{drawerOpen ? "▲" : "▼"}</span>
        </button>

        <button type="submit" className={`primary-btn ${styles.applyBtn}`}>
          Search
        </button>

        <button type="button" onClick={clearAll} className={styles.resetBtn}>
          Reset
        </button>
      </form>

      {activeChips.length > 0 && (
        <div className={styles.chipStrip} aria-label="Filter aktif">
          {activeChips.map((chip) => (
            <span key={chip.key} className={styles.filterChip}>
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={chip.onDismiss}
                className={styles.chipDismiss}
                aria-label={`Hapus filter ${chip.label}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {drawerOpen && (
        <div className={styles.advancedPanel}>
          <div>
            <h4 className={styles.filterSectionTitle}>Status Tiket</h4>
            <div className={styles.statusGrid}>
              {ALL_STATUSES.map((st) => (
                <label key={st} className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={statuses.includes(st)}
                    onChange={() => toggleStatus(st)}
                  />
                  <span>{st}</span>
                </label>
              ))}
            </div>
            <div className={styles.inlineLinks}>
              <button
                type="button"
                onClick={() => setStatuses(ALL_STATUSES)}
                className={styles.inlineLinkBtn}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setStatuses([])}
                className={styles.inlineLinkBtn}
              >
                Clear All
              </button>
            </div>
          </div>

          <div>
            <h4 className={styles.filterSectionTitle}>Assignment</h4>
            <div className={styles.checkStack}>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={assignments.includes("me")}
                  onChange={() => toggleAssignment("me")}
                />
                <span>Assigned to me</span>
              </label>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={assignments.includes("unassigned")}
                  onChange={() => toggleAssignment("unassigned")}
                />
                <span>Unassigned in queue</span>
              </label>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={assignments.includes("others")}
                  onChange={() => toggleAssignment("others")}
                />
                <span>Assigned to others</span>
              </label>
            </div>
          </div>

          <div>
            <h4 className={styles.filterSectionTitle}>Department Visibility</h4>
            <div className={styles.checkStack}>
              <label className={styles.checkLabel}>
                <input
                  type="radio"
                  name="visibility"
                  checked={!allDepts}
                  onChange={() => setAllDepts(false)}
                />
                <span>My Department Only</span>
              </label>
              <label className={styles.checkLabel}>
                <input
                  type="radio"
                  name="visibility"
                  checked={allDepts}
                  onChange={() => setAllDepts(true)}
                />
                <span>Show All Departments</span>
              </label>
            </div>
            <div className={styles.inlineLinks}>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  navigateWith();
                }}
                className={`primary-btn ${styles.applyBtn}`}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
