import { useEffect, useState } from "react";
import { apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

export default function AdminSalariesPage() {
  const [salaries, setSalaries] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    employeeName: "",
    amount: "",
    date: "",
  });

  async function loadSalaries() {
    const result = await apiRequest("/salaries");
    setSalaries(result.salaries || []);
  }

  useEffect(() => {
    loadSalaries().catch((error) => setMessage(error.message));
  }, []);

  async function handleCreateSalary(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      await apiRequest("/salaries", {
        method: "POST",
        body: JSON.stringify({
          employeeName: salaryForm.employeeName,
          amount: Number(salaryForm.amount),
          date: salaryForm.date,
        }),
      });

      setMessage("Salary record added");
      setSalaryForm({ employeeName: "", amount: "", date: "" });
      await loadSalaries();
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="content-card">
      <h2>Staff Salaries</h2>

      <form className="form-stack" onSubmit={handleCreateSalary}>
        <label>
          Employee name
          <input
            type="text"
            value={salaryForm.employeeName}
            onChange={(event) =>
              setSalaryForm({ ...salaryForm, employeeName: event.target.value })
            }
            placeholder="John Doe"
            required
          />
        </label>
        <label>
          Salary amount
          <input
            type="number"
            min="0"
            step="0.01"
            value={salaryForm.amount}
            onChange={(event) =>
              setSalaryForm({ ...salaryForm, amount: event.target.value })
            }
            placeholder="450"
            required
          />
        </label>
        <label>
          Salary date
          <input
            type="date"
            value={salaryForm.date}
            onChange={(event) =>
              setSalaryForm({ ...salaryForm, date: event.target.value })
            }
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Add salary record"}
        </button>
      </form>

      {message ? <p className="muted">{message}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {salaries.map((salary) => (
              <tr key={salary._id}>
                <td>{salary.employeeName}</td>
                <td>{formatINR(salary.amount)}</td>
                <td>{new Date(salary.date).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
