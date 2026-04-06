import { useEffect, useState } from "react";
import { apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);

  async function loadOrders() {
    const result = await apiRequest("/orders");
    setOrders(result.orders || []);
  }

  useEffect(() => {
    loadOrders().catch((error) => setMessage(error.message));
  }, []);

  function toggleSelect(orderId) {
    const updated = new Set(selectedIds);
    if (updated.has(orderId)) {
      updated.delete(orderId);
    } else {
      updated.add(orderId);
    }
    setSelectedIds(updated);
  }

  function toggleSelectAll() {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o._id)));
    }
  }

  async function handleDeleteOrder(orderId) {
    setMessage("");
    try {
      await apiRequest(`/orders/${orderId}`, { method: "DELETE" });
      setMessage("Order deleted");
      setSelectedIds(new Set());
      await loadOrders();
    } catch (requestError) {
      setMessage(requestError.message);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) {
      setMessage("Select orders to delete");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedIds.size} order(s)? This cannot be undone.`,
    );
    if (!confirmed) return;

    setMessage("");
    setLoading(true);

    try {
      let deleted = 0;
      for (const orderId of Array.from(selectedIds)) {
        try {
          await apiRequest(`/orders/${orderId}`, { method: "DELETE" });
          deleted += 1;
        } catch (error) {
          console.warn(`Failed to delete ${orderId}:`, error);
        }
      }
      setMessage(`${deleted} order(s) deleted`);
      setSelectedIds(new Set());
      await loadOrders();
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="content-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2>Orders</h2>
        {selectedIds.size > 0 && (
          <button
            type="button"
            className="secondary-button"
            onClick={handleBulkDelete}
            disabled={loading}
          >
            {loading ? "Deleting..." : `Delete ${selectedIds.size} selected`}
          </button>
        )}
      </div>

      {message ? <p className="muted">{message}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <input
                  type="checkbox"
                  checked={
                    selectedIds.size === orders.length && orders.length > 0
                  }
                  onChange={toggleSelectAll}
                />
              </th>
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
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(order._id)}
                    onChange={() => toggleSelect(order._id)}
                  />
                </td>
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
  );
}
