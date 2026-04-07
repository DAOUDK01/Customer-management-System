import { useEffect, useState } from "react";
import { apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function AdminSalariesPage() {
  const currentMonth = getCurrentMonth();
  const [salaries, setSalaries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    defaultMonthlySalary: "",
  });
  const [salaryForm, setSalaryForm] = useState({
    employeeId: "",
    month: currentMonth,
    monthlySalary: "",
    extraReceived: "0",
  });

  async function loadSalaries() {
    const result = await apiRequest("/salaries");
    const loadedSalaries = result.salaries || [];
    const loadedEmployees = result.employees || [];

    setSalaries(loadedSalaries);
    setEmployees(loadedEmployees);

    if (!salaryForm.employeeId && loadedEmployees.length > 0) {
      const firstEmployee = loadedEmployees[0];
      setSalaryForm((current) => ({
        ...current,
        employeeId: firstEmployee._id,
        monthlySalary:
          current.monthlySalary ||
          String(firstEmployee.monthlySalary || firstEmployee.defaultMonthlySalary || 0),
      }));
    }
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
          employeeId: salaryForm.employeeId,
          month: salaryForm.month,
          monthlySalary: Number(salaryForm.monthlySalary),
          extraReceived: Number(salaryForm.extraReceived || 0),
        }),
      });

      setMessage("Monthly salary saved");
      setSalaryForm({
        employeeId: salaryForm.employeeId,
        month: currentMonth,
        monthlySalary: "",
        extraReceived: "0",
      });
      await loadSalaries();
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateEmployee(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      await apiRequest("/salaries/employees", {
        method: "POST",
        body: JSON.stringify({
          name: employeeForm.name,
          defaultMonthlySalary: Number(employeeForm.defaultMonthlySalary),
        }),
      });

      setMessage("Employee added");
      setEmployeeForm({ name: "", defaultMonthlySalary: "" });
      await loadSalaries();
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEmployeeSelect(employeeId) {
    const employee = employees.find((entry) => entry._id === employeeId);
    setSalaryForm((current) => ({
      ...current,
      employeeId,
      monthlySalary:
        employee && Number(employee.monthlySalary) > 0
          ? String(employee.monthlySalary)
          : current.monthlySalary,
      month:
        current.month ||
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    }));
  }

  return (
    <section className="content-card">
      <h2>Salaries</h2>
      <p className="muted">Simple flow: create employee once, then add monthly salary.</p>

      <div className="two-col-grid">
        <form className="form-stack" onSubmit={handleCreateEmployee}>
          <h3>1. Create Employee</h3>
          <label>
            Employee name
            <input
              type="text"
              value={employeeForm.name}
              onChange={(event) =>
                setEmployeeForm({ ...employeeForm, name: event.target.value })
              }
              placeholder="Ali Khan"
              required
            />
          </label>
          <label>
            Default monthly salary
            <input
              type="number"
              min="0"
              step="0.01"
              value={employeeForm.defaultMonthlySalary}
              onChange={(event) =>
                setEmployeeForm({
                  ...employeeForm,
                  defaultMonthlySalary: event.target.value,
                })
              }
              placeholder="30000"
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Add employee"}
          </button>
        </form>

        <form className="form-stack" onSubmit={handleCreateSalary}>
          <h3>2. Add Monthly Salary</h3>
          <label>
            Employee
            <select
              value={salaryForm.employeeId}
              onChange={(event) => handleEmployeeSelect(event.target.value)}
              required
            >
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.name} ({formatINR(employee.monthlySalary || employee.defaultMonthlySalary)})
                </option>
              ))}
            </select>
          </label>
          <label>
            Month
            <input
              type="month"
              value={salaryForm.month}
              onChange={(event) =>
                setSalaryForm({ ...salaryForm, month: event.target.value })
              }
              required
            />
          </label>
          <label>
            Monthly salary
            <input
              type="number"
              min="0"
              step="0.01"
              value={salaryForm.monthlySalary}
              onChange={(event) =>
                setSalaryForm({
                  ...salaryForm,
                  monthlySalary: event.target.value,
                })
              }
              placeholder="30000"
              required
            />
          </label>
          <label>
            Extra received this month
            <input
              type="number"
              min="0"
              step="0.01"
              value={salaryForm.extraReceived}
              onChange={(event) =>
                setSalaryForm({
                  ...salaryForm,
                  extraReceived: event.target.value,
                })
              }
              placeholder="0"
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save salary"}
          </button>
        </form>
      </div>

      {message ? <p className="muted">{message}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>This Month Salary</th>
              <th>This Month Receiving</th>
              <th>Outstanding Advance</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee._id}>
                <td>{employee.name}</td>
                <td>{formatINR(employee.monthlySalary)}</td>
                <td>{formatINR(employee.monthlyReceiving)}</td>
                <td>{formatINR(employee.outstandingAdvance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Month</th>
              <th>Salary</th>
              <th>Receiving</th>
              <th>Extra</th>
              <th>Deduction</th>
            </tr>
          </thead>
          <tbody>
            {salaries.slice(0, 12).map((salary) => (
              <tr key={salary._id}>
                <td>{salary.employeeName}</td>
                <td>{salary.month}</td>
                <td>{formatINR(salary.monthlySalary)}</td>
                <td>{formatINR(salary.monthlyReceiving)}</td>
                <td>{formatINR(salary.extraReceived)}</td>
                <td>{formatINR(salary.deductionApplied)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
