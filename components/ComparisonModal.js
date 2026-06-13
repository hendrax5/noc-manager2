"use client";
import { useState, useEffect, useRef } from "react";

export default function ComparisonModal({ selectedUserIds = [], onClose, startDate = "", endDate = "" }) {
  const [usersData, setUsersData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const modalRef = useRef(null);

  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) setApiKey(savedKey);
  }, []);

  useEffect(() => {
    if (selectedUserIds.length === 0) return;

    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams();
        if (startDate) query.set("start", startDate);
        if (endDate) query.set("end", endDate);

        const fetches = selectedUserIds.map(async (id) => {
          const res = await fetch(`/api/reports/performance/${id}?${query.toString()}`);
          if (!res.ok) throw new Error(`Gagal memuat data untuk ID ${id}`);
          return res.json();
        });

        const results = await Promise.all(fetches);
        setUsersData(results);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [selectedUserIds, startDate, endDate]);

  // Close modal on clicking outside the container
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Fetch AI Analysis after usersData is populated
  useEffect(() => {
    if (usersData.length === 0) return;
    
    const fetchAiAnalysis = async () => {
      setIsAiLoading(true);
      try {
        const res = await fetch("/api/analyze-performance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usersData, apiKey })
        });
        const data = await res.json();
        if (data.analysis) {
          setAiAnalysis(data.analysis);
        }
      } catch (err) {
        console.error("Gagal mendapatkan analisa AI", err);
      } finally {
        setIsAiLoading(false);
      }
    };
    
    fetchAiAnalysis();
  }, [usersData, apiKey]);

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    localStorage.setItem("gemini_api_key", apiKey);
    // If we have data, setting the key will re-trigger the useEffect to fetch the analysis
  };

  // Close on Esc key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (selectedUserIds.length === 0) return null;

  // Find max values to scale comparison bars
  const maxScore = Math.max(...usersData.map(u => u.metrics?.finalScore || 1), 1);
  const maxResolved = Math.max(...usersData.map(u => u.metrics?.resolvedCount || 1), 1);
  const maxComments = Math.max(...usersData.map(u => u.metrics?.totalComments || 1), 1);

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="modal-overlay">
      <div className="comparison-modal" ref={modalRef}>
        <header className="drawer-header" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <div className="drawer-title-group">
            <span style={{ fontSize: "1.4rem" }}>📊</span>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", color: "var(--heading-color)" }}>Perbandingan Performa Anggota</h2>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>Membandingkan hasil kerja berdasarkan periode terpilih</p>
            </div>
          </div>
          <button className="drawer-close" onClick={onClose} title="Tutup">✖</button>
        </header>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px", flexDirection: "column", gap: "1rem" }}>
              <div style={{ width: "35px", height: "35px", border: "4px solid #cbd5e1", borderTopColor: "var(--secondary-color)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              <span style={{ color: "#64748b", fontSize: "0.9rem" }}>Memuat perbandingan performa...</span>
            </div>
          )}

          {error && (
            <div style={{ padding: "2rem" }}>
              <div className="card" style={{ borderLeft: "4px solid #ef4444", padding: "1rem", color: "#ef4444", margin: 0 }}>
                Gagal membandingkan data: {error}
              </div>
            </div>
          )}

          {!loading && !error && usersData.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "1.5rem" }}>
              
              {/* Profile headers & Quick metrics compare */}
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${usersData.length}, 1fr)`, gap: "1rem" }}>
                {usersData.map((data, idx) => (
                  <div key={idx} className="comparison-card" style={{ margin: 0 }}>
                    <div className="comparison-avatar" style={{ background: data.metrics.isCS ? "#3b82f6" : "#10b981" }}>
                      {data.user.avatarUrl ? (
                        <img src={data.user.avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        getInitials(data.user.name)
                      )}
                    </div>
                    <h3 style={{ margin: "0.25rem 0", fontSize: "0.95rem", color: "var(--heading-color)", wordBreak: "break-word" }}>{data.user.name}</h3>
                    <span className="badge" style={{ backgroundColor: "#64748b", marginBottom: "0.75rem", fontSize: "0.7rem" }}>
                      {data.user.department}
                    </span>

                    <div className="comparison-stat-row">
                      <div className="comparison-stat-item">
                        <span className="comparison-stat-label">Skor Kumulatif</span>
                        <span className="comparison-stat-value" style={{ color: "#10b981", fontSize: "0.95rem" }}>{data.metrics.finalScore} pts</span>
                      </div>
                      <div className="comparison-stat-item">
                        <span className="comparison-stat-label">Resolved Tiket</span>
                        <span className="comparison-stat-value" style={{ color: "var(--secondary-color)" }}>{data.metrics.resolvedCount}</span>
                      </div>
                      <div className="comparison-stat-item">
                        <span className="comparison-stat-label">Involved Tiket</span>
                        <span className="comparison-stat-value">{data.metrics.totalInvolvedCount}</span>
                      </div>
                      <div className="comparison-stat-item">
                        <span className="comparison-stat-label">Pertemuan</span>
                        <span className="comparison-stat-value">{data.metrics.meetingsAttended}/{data.metrics.meetingsScheduled}</span>
                      </div>
                      <div className="comparison-stat-item">
                        <span className="comparison-stat-label">Message Comments</span>
                        <span className="comparison-stat-value">{data.metrics.totalComments}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Graphic Comparison Bars */}
              <div className="card" style={{ padding: "1.25rem", margin: 0, display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                
                {/* 1. Skor Comparison */}
                <div>
                  <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "#64748b", textTransform: "uppercase" }}>Perbandingan Skor</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {usersData.map((data, idx) => {
                      const pct = (data.metrics.finalScore / maxScore) * 100;
                      return (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                          <span style={{ width: "120px", fontSize: "0.85rem", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={data.user.name}>
                            {data.user.name}
                          </span>
                          <div style={{ flex: 1, height: "16px", backgroundColor: "var(--border-color)", borderRadius: "8px", overflow: "hidden" }}>
                            <div style={{ 
                              width: `${pct}%`, 
                              height: "100%", 
                              backgroundColor: data.metrics.isCS ? "#3b82f6" : "#10b981", 
                              borderRadius: "8px",
                              transition: "width 0.3s ease-out"
                            }} />
                          </div>
                          <span style={{ width: "60px", fontSize: "0.85rem", fontWeight: "bold", textAlign: "right" }}>
                            {data.metrics.finalScore} pts
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Resolved Tickets Comparison */}
                <div>
                  <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "#64748b", textTransform: "uppercase" }}>Tiket yang Diselesaikan</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {usersData.map((data, idx) => {
                      const pct = (data.metrics.resolvedCount / maxResolved) * 100;
                      return (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                          <span style={{ width: "120px", fontSize: "0.85rem", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={data.user.name}>
                            {data.user.name}
                          </span>
                          <div style={{ flex: 1, height: "16px", backgroundColor: "var(--border-color)", borderRadius: "8px", overflow: "hidden" }}>
                            <div style={{ 
                              width: `${pct}%`, 
                              height: "100%", 
                              backgroundColor: "#3b82f6", 
                              borderRadius: "8px",
                              transition: "width 0.3s ease-out"
                            }} />
                          </div>
                          <span style={{ width: "60px", fontSize: "0.85rem", fontWeight: "bold", textAlign: "right" }}>
                            {data.metrics.resolvedCount} tkts
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Messages Comments Comparison */}
                <div>
                  <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "#64748b", textTransform: "uppercase" }}>Engagement Balasan Chat</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {usersData.map((data, idx) => {
                      const pct = (data.metrics.totalComments / maxComments) * 100;
                      return (
                        <div key={idx} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                          <span style={{ width: "120px", fontSize: "0.85rem", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={data.user.name}>
                            {data.user.name}
                          </span>
                          <div style={{ flex: 1, height: "16px", backgroundColor: "var(--border-color)", borderRadius: "8px", overflow: "hidden" }}>
                            <div style={{ 
                              width: `${pct}%`, 
                              height: "100%", 
                              backgroundColor: "#f59e0b", 
                              borderRadius: "8px",
                              transition: "width 0.3s ease-out"
                            }} />
                          </div>
                          <span style={{ width: "60px", fontSize: "0.85rem", fontWeight: "bold", textAlign: "right" }}>
                            {data.metrics.totalComments} msg
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* AI Analysis Section */}
              <div className="card" style={{ padding: "1.5rem", margin: 0, border: "1px solid var(--secondary-color)", background: "linear-gradient(to right, rgba(59, 130, 246, 0.05), transparent)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
                  <h4 style={{ margin: 0, fontSize: "1rem", color: "var(--secondary-color)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.2rem" }}>✨</span> Analisa Performa AI
                  </h4>
                  <form onSubmit={handleSaveApiKey} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input 
                      type="password" 
                      placeholder="Masukkan Gemini API Key" 
                      value={apiKey} 
                      onChange={(e) => setApiKey(e.target.value)}
                      style={{ padding: "0.4rem 0.6rem", borderRadius: "4px", border: "1px solid var(--border-color)", fontSize: "0.85rem", width: "200px" }}
                    />
                    <button type="submit" className="primary-btn" style={{ padding: "0.4rem 0.8rem", width: "auto", fontSize: "0.85rem" }}>Simpan Key</button>
                  </form>
                </div>
                {isAiLoading ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "#64748b" }}>
                    <div style={{ width: "20px", height: "20px", border: "3px solid #cbd5e1", borderTopColor: "var(--secondary-color)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
                    <span style={{ fontSize: "0.9rem" }}>Sedang menganalisa performa...</span>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: "1.6", color: "var(--text-color)", whiteSpace: "pre-wrap" }}>
                    {aiAnalysis || "Belum ada analisa yang dihasilkan."}
                  </p>
                )}
              </div>

            </div>
          )}
        </div>

        <footer style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", background: "var(--bg-color)" }}>
          <button className="primary-btn" onClick={onClose} style={{ width: "auto", padding: "0.5rem 1.5rem" }}>
            Tutup Perbandingan
          </button>
        </footer>
      </div>
    </div>
  );
}
