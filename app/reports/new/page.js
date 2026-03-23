import ReportForm from "./ReportForm"; 

export default function NewReportPage() {
  return (
    <main className="container">
      <header className="page-header">
        <h1>Submit Daily Report</h1>
        <p>Document your shift activities, tasks, and handover notes.</p>
      </header>
      <ReportForm />
    </main>
  );
}
