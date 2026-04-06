import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

function dateKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getLastNDays(n) {
  const days = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    days.push(dateKey(date));
  }
  return days;
}

export default function AdminAnalyticsPage() {
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiRequest("/orders")
      .then((result) => setOrders(result.orders || []))
      .catch((error) => setMessage(error.message));
  }, []);

  const analytics = useMemo(() => {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    );
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const byStatus = orders.reduce(
      (accumulator, order) => {
        accumulator[order.status] = (accumulator[order.status] || 0) + 1;
        return accumulator;
      },
      { processing: 0, completed: 0, incomplete: 0 },
    );

    const dailyMap = orders.reduce((accumulator, order) => {
      const key = dateKey(order.createdAt);
      if (!accumulator[key]) {
        accumulator[key] = { revenue: 0, orders: 0 };
      }
      accumulator[key].revenue += Number(order.totalAmount || 0);
      accumulator[key].orders += 1;
      return accumulator;
    }, {});

    const last7 = getLastNDays(7).map((day) => ({
      day,
      revenue: dailyMap[day]?.revenue || 0,
      orders: dailyMap[day]?.orders || 0,
    }));

    const itemMap = {};
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = item.name;
        if (!itemMap[key]) {
          itemMap[key] = { name: key, quantity: 0, revenue: 0 };
        }
        itemMap[key].quantity += Number(item.quantity || 0);
        itemMap[key].revenue +=
          Number(item.price || 0) * Number(item.quantity || 0);
      });
    });

    const topItems = Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      byStatus,
      last7,
      topItems,
    };
  }, [orders]);

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
            <span>Incomplete</span>
            <strong>{analytics.byStatus.incomplete || 0}</strong>
          </article>
        </div>
      </section>

      <section className="content-card">
        <h2>Last 7 Days Revenue</h2>
        {message ? <p className="muted">{message}</p> : null}
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
        <h2>Top Selling Items</h2>
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
              {analytics.topItems.map((item) => (
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
