export default function TicketsLoading() {
  return (
    <div className="container ui-static-2766893f5c" >
      <div className="ui-static-f15c085aca" style={{display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap"}}>
        <div>
          <div className="skeleton ui-static-fc11fc4f62" style={{width: "120px", height: "1.6rem"}} />
          <div className="skeleton" style={{ width: "220px", height: "0.85rem" }} />
        </div>
        <div className="skeleton" style={{ width: "140px", height: "2.25rem" }} />
      </div>

      <div className="ui-static-2a0b357ce7" style={{display: "flex", flexWrap: "wrap"}}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" style={{ width: "88px", height: "2rem" }} />
        ))}
      </div>

      <div className="ui-static-5f263a65e4" style={{overflow: "hidden"}}>
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
