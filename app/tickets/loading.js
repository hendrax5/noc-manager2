export default function TicketsLoading() {
  return (
    <div className="container" style={{ paddingTop: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div className="skeleton" style={{ width: "120px", height: "1.6rem", marginBottom: "0.5rem" }} />
          <div className="skeleton" style={{ width: "220px", height: "0.85rem" }} />
        </div>
        <div className="skeleton" style={{ width: "140px", height: "2.25rem" }} />
      </div>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ width: "88px", height: "2rem" }} />
        ))}
      </div>

      <div style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
        <table className="ticket-table-skeleton">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Status</th>
              <th>Assignee</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                <td><div className="skeleton" style={{ width: "72px", height: "0.9rem" }} /></td>
                <td><div className="skeleton" style={{ width: "70%", height: "0.9rem" }} /></td>
                <td><div className="skeleton" style={{ width: "64px", height: "0.9rem" }} /></td>
                <td><div className="skeleton" style={{ width: "96px", height: "0.9rem" }} /></td>
                <td><div className="skeleton" style={{ width: "80px", height: "0.9rem" }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
