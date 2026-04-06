import { useEffect, useState } from "react";
import { apiRequest } from "../../api";

export default function AdminStockPage() {
  const [entries, setEntries] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [stockDrafts, setStockDrafts] = useState({});
  const [stockForm, setStockForm] = useState({
    name: "",
    quantity: "",
    unit: "kg",
  });

  async function loadEntries() {
    const result = await apiRequest("/stocks");
    const loadedEntries = result.entries || [];
    setEntries(loadedEntries);
    setStockDrafts(
      loadedEntries.reduce((accumulator, entry) => {
        accumulator[entry._id] = entry.quantity;
        return accumulator;
      }, {}),
    );
  }

  useEffect(() => {
    loadEntries().catch((error) => setMessage(error.message));
  }, []);

  async function handleCreateStockEntry(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      await apiRequest("/stocks", {
        method: "POST",
        body: JSON.stringify({
          name: stockForm.name,
          quantity: Number(stockForm.quantity),
          unit: stockForm.unit,
        }),
      });
      setMessage("Stock item added");
      setStockForm({ name: "", quantity: "", unit: "kg" });
      await loadEntries();
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateStock(entryId) {
    setMessage("");
    try {
      await apiRequest(`/stocks/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: Number(stockDrafts[entryId] ?? 0) }),
      });
      setMessage("Stock updated");
      await loadEntries();
    } catch (requestError) {
      setMessage(requestError.message);
    }
  }

  async function handleDeleteStockEntry(entryId) {
    setMessage("");
    try {
      await apiRequest(`/stocks/${entryId}`, { method: "DELETE" });
      setMessage("Stock item removed");
      await loadEntries();
    } catch (requestError) {
      setMessage(requestError.message);
    }
  }

  return (
    <section className="content-card">
      <h2>Grocery Stock</h2>
      <p className="muted">
        Track raw materials like wheat, oil, and groceries.
      </p>

      <form className="form-stack" onSubmit={handleCreateStockEntry}>
        <label>
          Grocery name
          <input
            type="text"
            value={stockForm.name}
            onChange={(event) =>
              setStockForm({ ...stockForm, name: event.target.value })
            }
            placeholder="Wheat"
            required
          />
        </label>
        <label>
          Quantity
          <input
            type="number"
            min="0"
            step="0.01"
            value={stockForm.quantity}
            onChange={(event) =>
              setStockForm({ ...stockForm, quantity: event.target.value })
            }
            placeholder="25"
            required
          />
        </label>
        <label>
          Unit
          <input
            type="text"
            value={stockForm.unit}
            onChange={(event) =>
              setStockForm({ ...stockForm, unit: event.target.value })
            }
            placeholder="kg"
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Add stock item"}
        </button>
      </form>

      {message ? <p className="muted">{message}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry._id}>
                <td>{entry.name}</td>
                <td>{entry.quantity}</td>
                <td>{entry.unit}</td>
                <td>
                  <div className="qty-actions">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={stockDrafts[entry._id] ?? entry.quantity}
                      onChange={(event) =>
                        setStockDrafts((current) => ({
                          ...current,
                          [entry._id]: Number(event.target.value),
                        }))
                      }
                      className="stock-input"
                    />
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleUpdateStock(entry._id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleDeleteStockEntry(entry._id)}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
