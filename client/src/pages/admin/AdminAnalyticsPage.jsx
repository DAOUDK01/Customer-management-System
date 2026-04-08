import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

function getMonthKey(value) {
  const date = new Date(value || Date.now());
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getLastNDays(count) {
  const days = [];
  const today = new Date();

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    days.push(getDateKey(date));
  }

  return days;
}

function downloadWorkbook(filename, sheetName, rows) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function buildAnalytics(orders) {
  const completedOrders = orders.filter(
    (order) => order.status === "completed",
  );
  const totalRevenue = completedOrders.reduce(
    (sum, order) => sum + Number(order.totalAmount || 0),
    0,
  );

  const byStatus = orders.reduce(
    (accumulator, order) => {
      if (accumulator[order.status] !== undefined) {
        accumulator[order.status] += 1;
      }
      return accumulator;
    },
    { processing: 0, completed: 0, cancelled: 0 },
  );

  const dailyMap = completedOrders.reduce((accumulator, order) => {
    const day = getDateKey(order.createdAt);
    if (!accumulator[day]) {
      accumulator[day] = { day, orders: 0, revenue: 0 };
    }
    accumulator[day].orders += 1;
    accumulator[day].revenue += Number(order.totalAmount || 0);
    return accumulator;
  }, {});

  const last7 = getLastNDays(7).map(
    (day) => dailyMap[day] || { day, orders: 0, revenue: 0 },
  );

  return {
    totalOrders: orders.length,
    totalRevenue,
    averageOrderValue:
      completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0,
    byStatus,
    last7,
    completedOrders,
    currentMonth: getMonthKey(new Date()),
  };
}

function getTopItemsForMonth(completedOrders, monthKey) {
  if (!monthKey) {
    return [];
  }

  const [year, month] = monthKey.split("-").map(Number);
  const monthOrders = completedOrders.filter((order) => {
    const date = new Date(order.createdAt);
    return date.getFullYear() === year && date.getMonth() + 1 === month;
  });

  const itemMap = monthOrders.reduce((accumulator, order) => {
    (order.items || []).forEach((item) => {
      if (!accumulator[item.name]) {
        accumulator[item.name] = {
          name: item.name,
          quantity: 0,
          revenue: 0,
        };
      }

      accumulator[item.name].quantity += Number(item.quantity || 0);
      accumulator[item.name].revenue +=
        Number(item.quantity || 0) * Number(item.price || 0);
    });

    return accumulator;
  }, {});

  return Object.values(itemMap).sort((a, b) => b.quantity - a.quantity);
}

export default function AdminAnalyticsPage() {
  const [orders, setOrders] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey(new Date()));
  const [analyticsMessage, setAnalyticsMessage] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");

  useEffect(() => {
    Promise.allSettled([
      apiRequest("/orders?scope=all"),
      apiRequest("/orders/analytics"),
    ]).then(([ordersResult, analyticsResult]) => {
      const errors = [];

      if (ordersResult.status === "fulfilled") {
        setOrders(ordersResult.value.orders || []);
      } else {
        errors.push(ordersResult.reason.message);
      }

      if (analyticsResult.status === "fulfilled") {
        setAnalyticsData(analyticsResult.value);
      } else {
        errors.push(analyticsResult.reason.message);
      }

      if (errors.length > 0) {
        setAnalyticsMessage(errors.join(" "));
      }
    });
  }, []);

  const analytics = useMemo(() => {
    const fallbackAnalytics = buildAnalytics(orders);

    if (!analyticsData) {
      return fallbackAnalytics;
    }

    return {
      ...fallbackAnalytics,
      totalOrders: analyticsData.totalOrders ?? fallbackAnalytics.totalOrders,
      totalRevenue: analyticsData.totalRevenue ?? fallbackAnalytics.totalRevenue,
      averageOrderValue:
        analyticsData.averageOrderValue ?? fallbackAnalytics.averageOrderValue,
      byStatus: analyticsData.byStatus ?? fallbackAnalytics.byStatus,
      last7: analyticsData.last7 ?? fallbackAnalytics.last7,
      currentMonth:
        analyticsData.currentMonth ?? fallbackAnalytics.currentMonth,
      topItemsCurrentMonth:
        analyticsData.topItemsCurrentMonth ??
        fallbackAnalytics.topItemsCurrentMonth,
    };
  }, [analyticsData, orders]);

  const selectedMonthTopItems = useMemo(
    () => getTopItemsForMonth(analytics.completedOrders, selectedMonth),
    [analytics.completedOrders, selectedMonth],
  );

  function handleDownloadRevenue() {
    setDownloadMessage("");

    if (analytics.last7.length === 0) {
      setDownloadMessage("No revenue data available for download.");
      return;
    }

    downloadWorkbook(
      "revenue-details.xlsx",
      "Revenue",
      analytics.last7.map((entry) => ({
        Date: entry.day,
        Orders: entry.orders,
        Revenue: entry.revenue,
      })),
    );
    setDownloadMessage("Revenue Excel downloaded.");
  }

  function handleDownloadTopItems() {
    setDownloadMessage("");

    if (!selectedMonthTopItems.length) {
      setDownloadMessage("No top item data available for the selected month.");
      return;
    }

    downloadWorkbook(
      `top-items-${selectedMonth}.xlsx`,
      "TopItems",
      selectedMonthTopItems.map((item) => ({
        Month: selectedMonth,
        Item: item.name,
        QuantitySold: item.quantity,
        Revenue: item.revenue,
      })),
    );
    setDownloadMessage("Top items Excel downloaded.");
  }

  const monthLabel = selectedMonth || analytics.currentMonth;

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
              onChange={(event) => setSelectedMonth(event.target.value)}
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
              {selectedMonthTopItems.map((item) => (
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
