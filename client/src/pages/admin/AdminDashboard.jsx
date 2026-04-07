import { useEffect, useState } from "react";
import { apiRequest } from "../../api";
import { useAuth } from "../../state/AuthContext";
import { formatINR } from "../../utils/currency";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState({
    dailyRevenue: 0,
    monthlyRevenue: 0,
    yearlyRevenue: 0,
  });
  const [archiveBefore, setArchiveBefore] = useState("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");

  async function loadSummary() {
    const result = await apiRequest("/orders/revenue/summary");
    setSummary(result);
  }

  async function loadOrders() {
    const result = await apiRequest("/orders");
    setOrders(result.orders || []);
  }

  async function loadItems() {
    const result = await apiRequest("/items");
    setItems(result.items || []);
  }

  async function loadSalaries() {
    const result = await apiRequest("/salaries");
    setSalaries(result.salaries || []);
  }

  useEffect(() => {
    Promise.all([
      loadSummary(),
      loadOrders(),
      loadItems(),
      loadSalaries(),
    ]).catch((error) => setMessage(error.message));
  }, []);

  async function handleArchive(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const result = await apiRequest(
        `/orders/archive?before=${encodeURIComponent(archiveBefore)}`,
        {
          method: "DELETE",
        },
      );

      setMessage(`${result.message} (${result.deletedCount})`);
      await Promise.all([loadSummary(), loadOrders()]);
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteOrder(orderId) {
    setMessage("");
    try {
      await apiRequest(`/orders/${orderId}`, { method: "DELETE" });
      setMessage("Order deleted");
      await Promise.all([loadSummary(), loadOrders()]);
    } catch (requestError) {
      setMessage(requestError.message);
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin panel</p>
          <h1>Welcome, {user?.name || "Admin"}</h1>
          <p className="muted">
            Mobile-first control for finance, staff, and reporting.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={logout}>
          Logout
        </button>
      </header>

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

      <section className="content-card">
        <h2>Order history (full visibility)</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
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
                  <td>{order.status}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleDeleteOrder(order._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="content-card">
        <h2>Inventory overview</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>{item.name}</td>
                  <td>{formatINR(item.price)}</td>
                  <td>{item.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="content-card">
        <h2>Staff salary management</h2>
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#f5f5f5",
            borderRadius: "4px",
            marginBottom: "1rem",
          }}
        >
          <p style={{ margin: "0", fontSize: "0.95rem", color: "#666" }}>
            📍 Salary management has been moved to the <strong>Salaries</strong>{" "}
            tab for better organization. Use the Salaries page to add employees
            and manage their salary records.
          </p>
        </div>
      </section>
    </main>
  );
}
