import { useState } from "react";
import { apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

const RESTAURANT_NAME = "Delight and Dine";

function openPrintWindow(html, width, height) {
  const printWindow = window.open(
    "",
    "_blank",
    `width=${width},height=${height}`,
  );
  return printWindow;
}

export default function CreateOrderPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderForm, setOrderForm] = useState({
    name: "",
    price: "",
    quantity: "",
    discountAmount: "",
  });
  const [receipt, setReceipt] = useState(null);

  const receiptTotal = Number(receipt?.totalAmount || 0);
  const receiptDiscount = Number(receipt?.discountAmount || 0);
  const receiptSubtotal = Number(
    receipt?.subtotalAmount || receiptTotal + receiptDiscount,
  );

  function handlePrintThermalReceipt() {
    if (!receipt) {
      return;
    }

    const items = Array.isArray(receipt.items) ? receipt.items : [];
    const lineTotals = items.map(
      (item) => Number(item.price || 0) * Number(item.quantity || 0),
    );

    let assignedDiscount = 0;
    const discountedLines = items.map((item, index) => {
      const lineTotal = lineTotals[index];
      const isLastLine = index === items.length - 1;
      const lineDiscount = isLastLine
        ? Math.max(0, receiptDiscount - assignedDiscount)
        : Number(((lineTotal / Math.max(receiptSubtotal, 1)) * receiptDiscount).toFixed(2));

      assignedDiscount += lineDiscount;

      return {
        ...item,
        discountedLineTotal: Math.max(0, lineTotal - lineDiscount),
      };
    });

    const thermalHtml = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${RESTAURANT_NAME} Thermal Receipt ${receipt._id}</title>
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
          <p class="center">Order: ${receipt._id}</p>
          <p class="center">${new Date(receipt.createdAt).toLocaleString()}</p>
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
              ${discountedLines
                .map(
                  (item) => `
                    <tr>
                      <td>${item.name}</td>
                      <td class="right">${item.quantity}</td>
                      <td class="right">${formatINR(item.discountedLineTotal)}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
          <div class="line"></div>
          <p>SUBTOTAL: ${formatINR(receiptSubtotal)}</p>
          <p>DISCOUNT: -${formatINR(receiptDiscount)}</p>
          <p class="total">TOTAL: ${formatINR(receiptTotal)}</p>
          <p>Status: ${receipt.status}</p>
          <p class="footer">Thank you</p>
        </body>
      </html>
    `;

    const thermalWindow = openPrintWindow(thermalHtml, 420, 900);
    if (!thermalWindow) {
      setMessage("Popup blocked. Allow popups to print receipt.");
      return;
    }

    thermalWindow.document.write(thermalHtml);
    thermalWindow.document.close();
    thermalWindow.focus();
    thermalWindow.print();
  }

  async function handleCreateOrder(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const result = await apiRequest("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              name: orderForm.name,
              price: Number(orderForm.price),
              quantity: Number(orderForm.quantity),
            },
          ],
          discountAmount: Number(orderForm.discountAmount || 0),
          status: "processing",
        }),
      });

      setReceipt(result.order);
      setMessage("Order created successfully. Receipt is ready.");
      setOrderForm({ name: "", price: "", quantity: "", discountAmount: "" });
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
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

        <label>
          Discount amount
          <input
            type="number"
            min="0"
            step="0.01"
            value={orderForm.discountAmount}
            onChange={(event) =>
              setOrderForm({ ...orderForm, discountAmount: event.target.value })
            }
            placeholder="0.00"
          />
        </label>

        {message ? <p className="muted">{message}</p> : null}

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Create order"}
        </button>
      </form>

      {receipt ? (
        <article className="receipt-card">
          <div className="receipt-header">
            <h3>Receipt</h3>
            <div className="receipt-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={handlePrintThermalReceipt}
              >
                Print thermal POS
              </button>
            </div>
          </div>

          <p className="muted">Order ID: {receipt._id}</p>
          <p className="muted">
            Date: {new Date(receipt.createdAt).toLocaleString()}
          </p>
          <p className="muted">Status: {receipt.status}</p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, index) => (
                  <tr key={`${item.name}-${index}`}>
                    <td>{item.name}</td>
                    <td>{formatINR(item.price)}</td>
                    <td>{item.quantity}</td>
                    <td>
                      {formatINR(Number(item.price) * Number(item.quantity))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="muted">Subtotal: {formatINR(receiptSubtotal)}</p>
          <p className="muted">Discount: -{formatINR(receiptDiscount)}</p>
          <p className="receipt-total">Total: {formatINR(receiptTotal)}</p>
        </article>
      ) : null}
    </section>
  );
}
