import { useEffect, useMemo, useState } from "react";
import { apiDownload, apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

function downloadCsv(filename, rows) {
  const headers = Object.keys(rows[0] || {});
  const csvLines = [headers.join(",")];

  rows.forEach((row) => {
    const line = headers
      .map((key) => {
        const value = row[key] ?? "";
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(",");
    csvLines.push(line);
  });

  const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0,
    byStatus: { processing: 0, completed: 0, cancelled: 0 },
    last7: [],
    currentMonth: "",
    topItemsCurrentMonth: [],
  });
  const [topItemsByMonth, setTopItemsByMonth] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [analyticsMessage, setAnalyticsMessage] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");

  async function loadAnalytics() {
    const result = await apiRequest("/orders/analytics");
    setAnalytics(result);
    setSelectedMonth(result.currentMonth);
    setTopItemsByMonth(result.topItemsCurrentMonth || []);
  }

  useEffect(() => {
    loadAnalytics().catch((error) => setAnalyticsMessage(error.message));
  }, []);

  async function handleMonthChange(value) {
    setSelectedMonth(value);
    if (!value) {
      setTopItemsByMonth([]);
      return;
    }

    try {
      const result = await apiRequest(`/orders/top-items?month=${value}`);
      setTopItemsByMonth(result.items || []);
    } catch (error) {
      setAnalyticsMessage(error.message);
    }
  }

  async function handleDownloadRevenue() {
    setDownloadMessage("");
    try {
      await apiDownload("/orders/export/revenue", "revenue-details.xlsx");
    } catch (error) {
      try {
        const rows = (analytics.last7 || []).map((entry) => ({
          Date: entry.day,
          Orders: entry.orders,
          Revenue: entry.revenue,
        }));
        downloadCsv("revenue-details.csv", rows);
        setDownloadMessage("Excel route unavailable, downloaded CSV instead.");
      } catch {
        setDownloadMessage(error.message);
      }
    }
  }

  async function handleDownloadTopItems() {
    setDownloadMessage("");
    if (!selectedMonth) {
      setDownloadMessage("Select month first");
      return;
    }
    try {
      await apiDownload(
        `/orders/export/top-items?month=${selectedMonth}`,
        `top-items-${selectedMonth}.xlsx`,
      );
    } catch (error) {
      try {
        const result = await apiRequest(`/orders/top-items?month=${selectedMonth}`);
        const rows = (result.items || []).map((item) => ({
          Month: selectedMonth,
          Item: item.name,
          QuantitySold: item.quantity,
          Revenue: item.revenue,
        }));
        downloadCsv(`top-items-${selectedMonth}.csv`, rows);
        setDownloadMessage("Excel route unavailable, downloaded CSV instead.");
      } catch {
        setDownloadMessage(error.message);
      }
    }
  }

  const monthLabel = useMemo(
    () => selectedMonth || analytics.currentMonth,
    [selectedMonth, analytics.currentMonth],
  );

  return (
    <>
      <section className="card-grid">
        <article className="stat-card">
          <span>Total Orders</span>
          <strong>{analytics.totalOrders}</strong>
        </article>
        <article className="stat-card">
          <span>Total Revenue</span>
          <strong>{formatINR(analytics.totalRevenue)}</strong>
        </article>
        <article className="stat-card">
          <span>Average Order Value</span>
          <strong>{formatINR(analytics.averageOrderValue)}</strong>
        </article>
      </section>

      <section className="content-card">
        <h2>Order Status Breakdown</h2>
        <div className="card-grid">
          <article className="stat-card">
            <span>Processing</span>
            <strong>{analytics.byStatus.processing || 0}</strong>
          </article>
          <article className="stat-card">
            <span>Completed</span>
            <strong>{analytics.byStatus.completed || 0}</strong>
          </article>
          <article className="stat-card">
            <span>Cancelled</span>
            <strong>{analytics.byStatus.cancelled || 0}</strong>
          </article>
        </div>
      </section>

      <section className="content-card">
        <h2>Last 7 Days Revenue</h2>
        {analyticsMessage ? <p className="muted">{analyticsMessage}</p> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Orders</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {analytics.last7.map((entry) => (
                <tr key={entry.day}>
                  <td>{entry.day}</td>
                  <td>{entry.orders}</td>
                  <td>{formatINR(entry.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="content-card">
        <h2>Top Selling Items by Month</h2>
        <div className="inline-controls two-col-grid">
          <label>
            Select month
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => handleMonthChange(event.target.value)}
            />
          </label>
          <div className="download-actions">
            <button type="button" onClick={handleDownloadRevenue}>
              Download Revenue Excel
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleDownloadTopItems}
            >
              Download Top Items Excel
            </button>
          </div>
        </div>
        {downloadMessage ? <p className="muted">{downloadMessage}</p> : null}
        <p className="muted">Month: {monthLabel || "-"}</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty Sold</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topItemsByMonth.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>{formatINR(item.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
