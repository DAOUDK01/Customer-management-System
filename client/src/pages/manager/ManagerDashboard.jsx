import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

export default function ManagerDashboard() {
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiRequest("/orders?status=completed&scope=all")
      .then((result) => setOrders(result.orders || []))
      .catch((error) => setMessage(error.message));
  }, []);

  const summary = useMemo(() => {
    const totalRevenue = orders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    );

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const completedToday = orders.filter((order) => {
      const date = new Date(order.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return key === todayKey;
    }).length;

    return {
      completedOrders: orders.length,
      completedToday,
      totalRevenue,
    };
  }, [orders]);

  return (
    <>
      <section className="card-grid">
        <article className="stat-card">
          <span>All Completed Orders</span>
          <strong>{summary.completedOrders}</strong>
        </article>
        <article className="stat-card">
          <span>Completed Today</span>
          <strong>{summary.completedToday}</strong>
        </article>
        <article className="stat-card">
          <span>Revenue From Completed</span>
          <strong>{formatINR(summary.totalRevenue)}</strong>
        </article>
      </section>

      <section className="content-card">
        <h2>Completed Orders History</h2>
        <p className="muted">
          This view shows every completed order, not only today.
        </p>
        {message ? <p className="muted">{message}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Completed At</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id}>
                  <td>{new Date(order.createdAt).toLocaleString()}</td>
                  <td>
                    {order.items
                      .map((item) => `${item.name} x${item.quantity}`)
                      .join(", ")}
                  </td>
                  <td>{formatINR(order.totalAmount)}</td>
                  <td>
                    <span className="status-chip completed">Completed</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
