"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthRange() {
  const now = new Date();
  return {
    start: formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: formatDate(now)
  };
}

export default function MyPointsCard({ userId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const { start, end } = monthRange();
  const href = `/reports/${userId}?start=${start}&end=${end}`;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setError("");
    fetch(`/api/reports/performance/${userId}?start=${start}&end=${end}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memuat poin");
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, [userId, start, end]);

  const jobPoints = data?.metrics?.taskPoints ?? 0;
  const replyPoints = data?.metrics?.replyPoints ?? 0;
  const headline = data?.metrics?.isCS ? data.metrics.finalScore : jobPoints;

  return (
    <section className="card my-points-card">
      <div>
        <h2 style={{ margin: 0, fontSize: "1rem" }}>Poin saya</h2>
        <p style={{ margin: "0.25rem 0 0", color: "var(--muted-text)", fontSize: "0.85rem" }}>Bulan ini</p>
      </div>
      {error && <p className="error-text" style={{ margin: "0.75rem 0 0" }}>{error}</p>}
      {!data && !error && <div className="skeleton" style={{ height: 48, marginTop: "0.75rem" }} />}
      {data && (
        <div className="my-points-body">
          <span className="report-score-value kpi-value">{headline}</span>
          <p>
            Job {jobPoints} · Balasan {replyPoints}
          </p>
          <Link href={href}>Lihat rincian</Link>
        </div>
      )}
    </section>
  );
}
