export default function SlaLetterView({ letter, monthSections = [] }) {
  if (!letter) return null;
  const company = letter.company || {};
  const sign = letter.signatory || {};

  return (
    <article className="sla-letter">
      <header className="sla-letter-cover">
        <p className="sla-letter-kicker">ION Network</p>
        <h1>Laporan penggunaan bandwidth</h1>
        <p className="sla-letter-customer">{letter.customer}</p>
        <p className="sla-letter-period">Periode {letter.periodLabel}</p>
        <p className="sla-letter-meta">
          {company.headOffice}
          <br />
          {company.noc}
          <br />
          {company.phone} · {company.email}
        </p>
      </header>

      <section className="sla-letter-intro">
        <h2>Pendahuluan</h2>
        <p>{letter.intro}</p>
        <p>
          ION Network selalu berusaha menjaga kualitas layanan dengan perawatan berkala, prioritas
          pada perbaikan khususnya pada jalur backbone dan media local loop (Fiber Optik, Wireless
          dan VSAT) serta update informasi gangguan kepada pelanggan. Laporan kami sampaikan
          sebagai berikut.
        </p>
      </section>

      {monthSections.length === 0 && (
        <p className="sla-letter-empty">Tidak ada catatan outage pada periode ini.</p>
      )}

      {monthSections.map((section) => (
        <section key={section.monthKey} className="sla-letter-section">
          <h2>Detail outage information</h2>
          <dl className="sla-letter-meta-grid">
            <div>
              <dt>Customer</dt>
              <dd>{letter.customer}</dd>
            </div>
            <div>
              <dt>Periode</dt>
              <dd>{section.monthLabel}</dd>
            </div>
            <div>
              <dt>SLA</dt>
              <dd>{section.slaPercent}%</dd>
            </div>
            <div>
              <dt>Avail</dt>
              <dd>{section.availPercent}%</dd>
            </div>
            <div>
              <dt>Tdown</dt>
              <dd>{section.tdownPercent}%</dd>
            </div>
          </dl>

          <div className="sla-letter-table-wrap">
            <table className="sla-letter-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Customer</th>
                  <th>Incident date</th>
                  <th>Down</th>
                  <th>Up</th>
                  <th>Duration</th>
                  <th>Problem cause</th>
                  <th>Corrective actions</th>
                </tr>
              </thead>
              <tbody>
                {section.incidents.map((inc) => (
                  <tr key={`${inc.dbId}-${inc.no}`}>
                    <td>{inc.no}</td>
                    <td>
                      {inc.customer}
                      <div className="sla-letter-sub">
                        <a href={`/tickets/${inc.dbId}`}>{inc.id || inc.title}</a>
                      </div>
                    </td>
                    <td>{inc.incidentDate}</td>
                    <td>{inc.downAt}</td>
                    <td>{inc.upAt}</td>
                    <td>{inc.duration}{inc.downtimeOngoing ? " *" : ""}</td>
                    <td>{inc.cause}</td>
                    <td>{inc.corrective}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sla-letter-footnote">Waktu dalam GMT+7. * = outage masih berjalan pada akhir periode.</p>
        </section>
      ))}

      <section className="sla-letter-close">
        <p>
          Demikian laporan performasi jaringan kami sampaikan sesuai dengan data yang terdapat pada
          sistem monitoring ION Network. Atas perhatiannya kami mengucapkan terima kasih.
        </p>
        <div className="sla-letter-sign">
          <div>
            <strong>{sign.customerName}</strong>
            <p>Nama :</p>
            <p>NIP :</p>
          </div>
          <div>
            <strong>{company.name}</strong>
            <p>Nama : {sign.nocName}</p>
            <p>Jabatan : {sign.nocTitle}</p>
          </div>
        </div>
      </section>
    </article>
  );
}
