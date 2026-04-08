import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

const ORDER_STATUS_OPTIONS = ["processing", "completed", "cancelled"];

function getDayKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getMonthKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [summaryView, setSummaryView] = useState("day");

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

  async function handleStatusUpdate(orderId, status) {
    setMessage("");

    if (status === "processing") {
      setMessage("Admin can set status to completed or cancelled only.");
      return;
    }

    try {
      await apiRequest(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage("Order status updated");
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

  const groupedSummary = useMemo(() => {
    const map = new Map();

    orders.forEach((order) => {
      const key = summaryView === "day" ? getDayKey(order.createdAt) : getMonthKey(order.createdAt);
      const current = map.get(key) || {
        period: key,
        completed: 0,
        incompleted: 0,
        total: 0,
      };

      current.total += 1;
      if (order.status === "completed") {
        current.completed += 1;
      } else {
        current.incompleted += 1;
      }

      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) =>
      String(b.period).localeCompare(String(a.period)),
    );
  }, [orders, summaryView]);

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

      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0 }}>Order Summary</h3>
        <label>
          View
          <select
            value={summaryView}
            onChange={(event) => setSummaryView(event.target.value)}
            style={{ marginLeft: "0.5rem" }}
          >
            <option value="day">Per day</option>
            <option value="month">Per month</option>
          </select>
        </label>
      </div>

      <div className="table-wrap" style={{ marginBottom: "1rem" }}>
        <table>
          <thead>
            <tr>
              <th>{summaryView === "day" ? "Day" : "Month"}</th>
              <th>Completed</th>
              <th>Incomplete</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {groupedSummary.length > 0 ? (
              groupedSummary.map((entry) => (
                <tr key={entry.period}>
                  <td>{entry.period}</td>
                  <td>{entry.completed}</td>
                  <td>{entry.incompleted}</td>
                  <td>{entry.total}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4">No orders yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
                <td>
                  <select
                    value={order.status}
                    onChange={(event) =>
                      handleStatusUpdate(order._id, event.target.value)
                    }
                  >
                    {ORDER_STATUS_OPTIONS.map((status) => (
                      <option
                        key={status}
                        value={status}
                        disabled={status === "processing"}
                      >
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
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
