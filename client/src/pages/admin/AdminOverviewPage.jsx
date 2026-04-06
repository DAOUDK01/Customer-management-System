import { useEffect, useState } from "react";
import { apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

export default function AdminOverviewPage() {
  const [summary, setSummary] = useState({
    dailyRevenue: 0,
    monthlyRevenue: 0,
    yearlyRevenue: 0,
  });
  const [rangeRevenue, setRangeRevenue] = useState(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [archiveBefore, setArchiveBefore] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadSummary() {
    const result = await apiRequest("/orders/revenue/summary");
    setSummary(result);
  }

  useEffect(() => {
    loadSummary().catch((error) => setMessage(error.message));
  }, []);

  async function handleArchive(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const result = await apiRequest(
        `/orders/archive?before=${encodeURIComponent(archiveBefore)}`,
        { method: "DELETE" },
      );
      setMessage(`${result.message} (${result.deletedCount})`);
      await loadSummary();
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGetRangeRevenue(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const result = await apiRequest(
        `/orders/revenue/range?from=${fromDate}&to=${toDate}`,
      );
      setRangeRevenue(result);
    } catch (requestError) {
      setMessage(requestError.message);
      setRangeRevenue(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="card-grid">
        <article className="stat-card">
          <span>Daily Revenue</span>
          <strong>{formatINR(summary.dailyRevenue)}</strong>
        </article>
        <article className="stat-card">
          <span>Monthly Revenue</span>
          <strong>{formatINR(summary.monthlyRevenue)}</strong>
        </article>
        <article className="stat-card">
          <span>Yearly Revenue</span>
          <strong>{formatINR(summary.yearlyRevenue)}</strong>
        </article>
      </section>

      <section className="content-card">
        <h2>Revenue by date range</h2>
        <form className="form-stack" onSubmit={handleGetRangeRevenue}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            <label>
              From
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                required
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                required
              />
            </label>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Fetching..." : "Get revenue"}
          </button>
        </form>

        {rangeRevenue ? (
          <div className="card-grid" style={{ marginTop: "1rem" }}>
            <article className="stat-card">
              <span>Total Orders</span>
              <strong>{rangeRevenue.orders}</strong>
            </article>
            <article className="stat-card">
              <span>Total Revenue</span>
              <strong>{formatINR(rangeRevenue.revenue)}</strong>
            </article>
          </div>
        ) : null}
      </section>

      <section className="content-card">
        <h2>Archive old records</h2>
        <form className="form-stack" onSubmit={handleArchive}>
          <label>
            Delete records before
            <input
              type="date"
              value={archiveBefore}
              onChange={(event) => setArchiveBefore(event.target.value)}
              required
            />
          </label>

          {message ? <p className="muted">{message}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? "Cleaning..." : "Delete old records"}
          </button>
        </form>
      </section>
    </>
  );
}
