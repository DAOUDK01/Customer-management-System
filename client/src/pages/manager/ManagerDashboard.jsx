import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

export default function ManagerDashboard() {
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiRequest("/orders?status=completed")
      .then((result) => setOrders(result.orders || []))
      .catch((error) => setMessage(error.message));
  }, []);

  const summary = useMemo(() => {
    const totalRevenue = orders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    );

    return {
      completedOrders: orders.length,
      totalRevenue,
    };
  }, [orders]);

  return (
    <>
      <section className="card-grid">
        <article className="stat-card">
          <span>Today&apos;s Completed Orders</span>
          <strong>{summary.completedOrders}</strong>
        </article>
        <article className="stat-card">
          <span>Today&apos;s Revenue</span>
          <strong>{formatINR(summary.totalRevenue)}</strong>
        </article>
        <article className="stat-card">
          <span>Status</span>
          <strong>Completed</strong>
        </article>
      </section>

      <section className="content-card">
        <h2>Today&apos;s Completed Orders</h2>
        <p className="muted">
          This view shows only completed orders created today.
        </p>
        {message ? <p className="muted">{message}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Completed At</th>
                <th>Items</th>
                <th>Subtotal</th>
                <th>Discount</th>
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
                  <td>
                    {formatINR(
                      Number(
                        order.subtotalAmount ||
                          Number(order.totalAmount || 0) +
                            Number(order.discountAmount || 0),
                      ),
                    )}
                  </td>
                  <td>{formatINR(Number(order.discountAmount || 0))}</td>
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
