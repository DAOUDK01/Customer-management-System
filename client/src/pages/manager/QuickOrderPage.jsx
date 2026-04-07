import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

const RESTAURANT_NAME = "Delight and Dine";

function openPrintWindow(html, width, height) {
  return window.open("", "_blank", `width=${width},height=${height}`);
}

export default function QuickOrderPage() {
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0,
      ),
    [cart],
  );

  async function loadItems() {
    const result = await apiRequest("/items");
    setItems(result.items || []);
  }

  useEffect(() => {
    loadItems().catch((error) => setMessage(error.message));
  }, []);

  function addItemToCart(item) {
    setCart((current) => {
      const existing = current.find((entry) => entry.itemId === item._id);
      if (existing) {
        return current.map((entry) =>
          entry.itemId === item._id
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry,
        );
      }
      return [
        ...current,
        { itemId: item._id, name: item.name, price: item.price, quantity: 1 },
      ];
    });
  }

  function updateQuantity(itemId, nextQuantity) {
    setCart((current) => {
      if (nextQuantity <= 0) {
        return current.filter((entry) => entry.itemId !== itemId);
      }
      return current.map((entry) =>
        entry.itemId === itemId ? { ...entry, quantity: nextQuantity } : entry,
      );
    });
  }

  function clearCart() {
    setCart([]);
  }

  function printThermalReceipt(receiptData = receipt) {
    if (!receiptData) {
      return;
    }

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${RESTAURANT_NAME} Thermal Receipt ${receiptData._id}</title>
          <style>
            @page { size: 80mm auto; margin: 4mm; }
            body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; color: #000; font-size: 12px; }
            h1 { margin: 0; text-align: center; font-size: 14px; }
            p { margin: 3px 0; }
            .center { text-align: center; }
            .line { border-top: 1px dashed #000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 2px 0; text-align: left; vertical-align: top; }
            th { font-weight: 700; }
            .right { text-align: right; }
            .total { font-weight: 700; margin-top: 6px; }
            .footer { margin-top: 8px; text-align: center; }
          </style>
        </head>
        <body>
          <h1>${RESTAURANT_NAME}</h1>
          <p class="center">Order: ${receiptData._id}</p>
          <p class="center">${new Date(receiptData.createdAt).toLocaleString()}</p>
          <div class="line"></div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="right">Qty</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${receiptData.items
                .map(
                  (item) =>
                    `<tr><td>${item.name}</td><td class="right">${item.quantity}</td><td class="right">${formatINR(Number(item.price) * Number(item.quantity))}</td></tr>`,
                )
                .join("")}
            </tbody>
          </table>
          <div class="line"></div>
          <p class="total">TOTAL: ${formatINR(receiptData.totalAmount)}</p>
          <p>Status: ${receiptData.status}</p>
          <p class="footer">Thank you</p>
        </body>
      </html>
    `;

    const printWindow = openPrintWindow(html, 420, 900);
    if (!printWindow) {
      setMessage("Popup blocked. Allow popups to print receipt.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function handlePlaceOrder() {
    if (cart.length === 0) {
      setMessage("Add at least one item");
      return;
    }

    setMessage("");
    setLoading(true);

    try {
      const result = await apiRequest("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((entry) => ({
            name: entry.name,
            price: Number(entry.price),
            quantity: Number(entry.quantity),
          })),
          status: "processing",
        }),
      });

      setReceipt(result.order);
      setCart([]);
      setMessage("Order created and thermal receipt sent to print.");
      await loadItems();
      printThermalReceipt(result.order);
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="content-card quick-order-shell">
      <div className="quick-order-head">
        <h2>Quick order (click items)</h2>
        <p className="muted">Select from the menu panel, then review and place order from the cart panel.</p>
      </div>

      <div className="quick-order-layout">
        <article className="quick-order-panel">
          <div className="quick-order-panel-head">
            <h3>Menu Items</h3>
            <span className="muted">Tap to add in cart</span>
          </div>
          <div className="quick-grid">
            {items.map((item) => (
              <button
                key={item._id}
                type="button"
                className="quick-item-btn"
                onClick={() => addItemToCart(item)}
              >
                <strong>{item.name}</strong>
                <span>{formatINR(item.price)}</span>
                <small>Tap to add</small>
              </button>
            ))}
          </div>
        </article>

        <article className="quick-order-panel quick-order-cart-panel">
          <div className="quick-order-panel-head">
            <h3>Current Cart</h3>
            <span className="quick-cart-count">{cart.length} item(s)</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Line Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((entry) => (
                  <tr key={entry.itemId}>
                    <td>{entry.name}</td>
                    <td>{formatINR(entry.price)}</td>
                    <td>{entry.quantity}</td>
                    <td>
                      {formatINR(Number(entry.price) * Number(entry.quantity))}
                    </td>
                    <td>
                      <div className="qty-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            updateQuantity(entry.itemId, entry.quantity - 1)
                          }
                        >
                          -
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            updateQuantity(entry.itemId, entry.quantity + 1)
                          }
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="receipt-total">Order Total: {formatINR(cartTotal)}</p>
          {message ? <p className="muted">{message}</p> : null}

          <div className="receipt-actions">
            <button type="button" onClick={handlePlaceOrder} disabled={loading}>
              {loading ? "Placing..." : "Place order"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={clearCart}
            >
              Clear cart
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => printThermalReceipt(receipt)}
            >
              Print thermal POS
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
