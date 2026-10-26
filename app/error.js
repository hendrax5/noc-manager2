"use client";
import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-level error boundary.
 * A render failure (for example an unexpected JSON shape reaching JSX) shows this
 * recoverable screen instead of leaving the page unusable, and keeps the digest
 * visible so the failure can be traced in the server log.
 */
export default function AppError({ error, reset }) {
  useEffect(() => {
    console.error("[ui] render error:", error);
  }, [error]);

  return (
    <main className="container">
      <section className="card" role="alert" aria-live="assertive" style={{ maxWidth: "46rem" }}>
        <h1 style={{ marginTop: 0, color: "var(--heading-color)" }}>Halaman gagal dimuat</h1>
        <p style={{ color: "var(--muted-text)", marginTop: "0.5rem" }}>
          Terjadi kesalahan saat menampilkan halaman ini. Data tidak berubah — silakan coba lagi
          atau kembali ke dashboard.
        </p>

        {error?.digest && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--muted-text)" }}>
            Kode kesalahan: {error.digest}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.25rem" }}>
          <button type="button" className="primary-btn btn-fit" onClick={() => reset()}>
            Coba lagi
          </button>
          <Link
            href="/dashboard"
            className="secondary-btn"
            style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
          >
            Kembali ke Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
