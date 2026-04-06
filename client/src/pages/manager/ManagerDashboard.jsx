import { useEffect, useState } from "react";
import { apiRequest } from "../../api";
import { useAuth } from "../../state/AuthContext";

const ORDER_STATUS = ["processing", "completed", "incomplete"];

export default function ManagerDashboard() {
  const { user, logout } = useAuth();
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [completedOrders, setCompletedOrders] = useState(0);
  const [orders, setOrders] = useState([]);
  const [orderFilter, setOrderFilter] = useState("");
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderForm, setOrderForm] = useState({
    name: "",
    price: "",
    quantity: "",
  });
  const [itemForm, setItemForm] = useState({ name: "", price: "", stock: "" });

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

  async function loadItems() {
    const result = await apiRequest("/items");
    setItems(result.items || []);
  }

  useEffect(() => {
    Promise.all([loadRevenue(), loadOrders(), loadItems()]).catch((error) =>
      setMessage(error.message),
    );
  }, [orderFilter]);

  async function handleCreateOrder(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      await apiRequest("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              name: orderForm.name,
              price: Number(orderForm.price),
              quantity: Number(orderForm.quantity),
            },
          ],
          status: "processing",
        }),
      });

      setMessage("Order created successfully");
      setOrderForm({ name: "", price: "", quantity: "" });
      await Promise.all([loadRevenue(), loadOrders()]);
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setLoading(false);
    }
  }

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

  async function handleCreateOrUpdateItem(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      await apiRequest("/items", {
        method: "POST",
        body: JSON.stringify({
          name: itemForm.name,
          price: Number(itemForm.price),
          stock: Number(itemForm.stock),
        }),
      });

      setMessage("Inventory item saved");
      setItemForm({ name: "", price: "", stock: "" });
      await loadItems();
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickStockUpdate(itemId, stock) {
    setMessage("");
    try {
      await apiRequest(`/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ stock: Number(stock) }),
      });
      setMessage("Stock updated");
      await loadItems();
    } catch (requestError) {
      setMessage(requestError.message);
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Manager panel</p>
          <h1>Welcome, {user?.name || "Manager"}</h1>
          <p className="muted">
            Desktop-first workflow for orders and daily operations.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={logout}>
          Logout
        </button>
      </header>

      <section className="card-grid">
        <article className="stat-card">
          <span>Today&apos;s Revenue</span>
          <strong>${todayRevenue.toFixed(2)}</strong>
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
        <h2>Create order</h2>
        <form className="form-stack" onSubmit={handleCreateOrder}>
          <label>
            Item name
            <input
              type="text"
              value={orderForm.name}
              onChange={(event) =>
                setOrderForm({ ...orderForm, name: event.target.value })
              }
              placeholder="Chicken meal"
              required
            />
          </label>

          <label>
            Price
            <input
              type="number"
              min="0"
              step="0.01"
              value={orderForm.price}
              onChange={(event) =>
                setOrderForm({ ...orderForm, price: event.target.value })
              }
              placeholder="12.50"
              required
            />
          </label>

          <label>
            Quantity
            <input
              type="number"
              min="1"
              step="1"
              value={orderForm.quantity}
              onChange={(event) =>
                setOrderForm({ ...orderForm, quantity: event.target.value })
              }
              placeholder="1"
              required
            />
          </label>

          {message ? <p className="muted">{message}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Create order"}
          </button>
        </form>
      </section>

      <section className="content-card">
        <h2>Order history</h2>
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
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
                  <td>${Number(order.totalAmount).toFixed(2)}</td>
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

      <section className="content-card">
        <h2>Inventory management</h2>
        <form className="form-stack" onSubmit={handleCreateOrUpdateItem}>
          <label>
            Item name
            <input
              type="text"
              value={itemForm.name}
              onChange={(event) =>
                setItemForm({ ...itemForm, name: event.target.value })
              }
              placeholder="Burger"
              required
            />
          </label>
          <label>
            Price
            <input
              type="number"
              min="0"
              step="0.01"
              value={itemForm.price}
              onChange={(event) =>
                setItemForm({ ...itemForm, price: event.target.value })
              }
              placeholder="8.50"
              required
            />
          </label>
          <label>
            Stock
            <input
              type="number"
              min="0"
              step="1"
              value={itemForm.stock}
              onChange={(event) =>
                setItemForm({ ...itemForm, stock: event.target.value })
              }
              placeholder="20"
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Add inventory item"}
          </button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Quick update</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>{item.name}</td>
                  <td>${Number(item.price).toFixed(2)}</td>
                  <td>{item.stock}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        handleQuickStockUpdate(item._id, item.stock + 1)
                      }
                    >
                      +1
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
