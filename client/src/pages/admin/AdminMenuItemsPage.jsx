import { useEffect, useState } from "react";
import { apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

export default function AdminMenuItemsPage() {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [itemForm, setItemForm] = useState({ name: "", price: "" });

  async function loadItems() {
    const result = await apiRequest("/items");
    setItems(result.items || []);
  }

  useEffect(() => {
    loadItems().catch((error) => setMessage(error.message));
  }, []);

  async function handleCreateItem(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      await apiRequest("/items", {
        method: "POST",
        body: JSON.stringify({
          name: itemForm.name,
          price: Number(itemForm.price),
          stock: 0,
        }),
      });
      setMessage("Menu item added");
      setItemForm({ name: "", price: "" });
      await loadItems();
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteItem(itemId) {
    setMessage("");
    try {
      await apiRequest(`/items/${itemId}`, { method: "DELETE" });
      setMessage("Menu item removed");
      await loadItems();
    } catch (requestError) {
      setMessage(requestError.message);
    }
  }

  return (
    <section className="content-card">
      <h2>Menu Items</h2>

      <form className="form-stack" onSubmit={handleCreateItem}>
        <label>
          Item name
          <input
            type="text"
            value={itemForm.name}
            onChange={(event) =>
              setItemForm({ ...itemForm, name: event.target.value })
            }
            placeholder="Paneer Roll"
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
            placeholder="120"
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Add menu item"}
        </button>
      </form>

      {message ? <p className="muted">{message}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Price</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item._id}>
                <td>{item.name}</td>
                <td>{formatINR(item.price)}</td>
                <td>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleDeleteItem(item._id)}
                  >
                    Remove
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
