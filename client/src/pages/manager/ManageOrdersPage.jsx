import { useEffect, useState } from "react";
import { apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

const ORDER_STATUS = ["processing", "completed", "cancelled"];

export default function ManageOrdersPage() {
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [completedOrders, setCompletedOrders] = useState(0);
  const [orders, setOrders] = useState([]);
  const [orderFilter, setOrderFilter] = useState("");
  const [message, setMessage] = useState("");

  async function loadRevenue() {
    const result = await apiRequest("/orders/revenue/today");
    setTodayRevenue(result.revenue);
    setCompletedOrders(result.orders);
  }

  async function loadOrders() {
    const suffix = orderFilter
      ? `?status=${encodeURIComponent(orderFilter)}`
      : "";
    const result = await apiRequest(`/orders${suffix}`);
    setOrders(result.orders || []);
  }

  useEffect(() => {
    Promise.all([loadRevenue(), loadOrders()]).catch((error) =>
      setMessage(error.message),
    );
  }, [orderFilter]);

  async function handleOrderStatusUpdate(orderId, status) {
    setMessage("");
    try {
      await apiRequest(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage("Order status updated");
      await Promise.all([loadRevenue(), loadOrders()]);
    } catch (requestError) {
      setMessage(requestError.message);
    }
  }

  return (
    <>
      <section className="card-grid">
        <article className="stat-card">
          <span>Today&apos;s Revenue</span>
          <strong>{formatINR(todayRevenue)}</strong>
        </article>
        <article className="stat-card">
          <span>Today&apos;s Orders</span>
          <strong>{orders.length}</strong>
        </article>
        <article className="stat-card">
          <span>Completed Orders</span>
          <strong>{completedOrders}</strong>
        </article>
      </section>

      <section className="content-card">
        <h2>Manage orders</h2>
        <div className="inline-controls">
          <label>
            Filter status
            <select
              value={orderFilter}
              onChange={(event) => setOrderFilter(event.target.value)}
            >
              <option value="">All</option>
              {ORDER_STATUS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        {message ? <p className="muted">{message}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
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
                    <select
                      value={order.status}
                      onChange={(event) =>
                        handleOrderStatusUpdate(order._id, event.target.value)
                      }
                    >
                      {ORDER_STATUS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
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
