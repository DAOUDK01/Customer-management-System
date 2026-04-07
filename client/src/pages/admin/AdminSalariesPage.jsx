import { useEffect, useMemo, useState } from "react";
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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
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

    if (!selectedEmployeeId && loadedEmployees.length > 0) {
      const firstEmployeeId = String(loadedEmployees[0]._id);
      setSelectedEmployeeId(firstEmployeeId);
      setSalaryForm((current) => ({
        ...current,
        employeeId: firstEmployeeId,
        monthlySalary: String(
          loadedEmployees[0].monthlySalary ||
            loadedEmployees[0].defaultMonthlySalary ||
            0,
        ),
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
      await apiRequest("/salaries", {
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
    setSelectedEmployeeId(employeeId);
    setSalaryForm((current) => ({
      ...current,
      employeeId,
      monthlySalary: employee
        ? String(employee.monthlySalary || employee.defaultMonthlySalary || 0)
        : current.monthlySalary,
      month: current.month || currentMonth,
    }));
  }

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee._id === selectedEmployeeId),
    [employees, selectedEmployeeId],
  );

  const selectedEmployeeSalaries = useMemo(
    () =>
      salaries.filter(
        (salary) =>
          String(salary.employeeId) === String(selectedEmployeeId) ||
          salary.employeeName === selectedEmployee?.name,
      ),
    [salaries, selectedEmployeeId, selectedEmployee],
  );

  useEffect(() => {
    if (!selectedEmployee) {
      return;
    }

    setSalaryForm((current) => ({
      ...current,
      employeeId: selectedEmployee._id,
      monthlySalary:
        current.monthlySalary ||
        String(
          selectedEmployee.monthlySalary ||
            selectedEmployee.defaultMonthlySalary ||
            0,
        ),
    }));
  }, [selectedEmployee]);

  return (
    <section className="content-card">
      <h2>Salaries</h2>
      <p className="muted">
        Select an employee box to view salary details, then add a new salary
        entry.
      </p>

      <section className="salary-create-bar">
        <div>
          <h3>Add New Employee</h3>
          <p className="muted">
            Create once, then click the employee box to manage salaries.
          </p>
        </div>
        <form className="salary-create-form" onSubmit={handleCreateEmployee}>
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
            Default salary
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
          <button type="submit" className="secondary-button" disabled={loading}>
            {loading ? "Saving..." : "Add employee"}
          </button>
        </form>
      </section>

      <div className="employee-grid">
        {employees.map((employee) => {
          const isSelected =
            String(employee._id) === String(selectedEmployeeId);

          return (
            <button
              key={employee._id}
              type="button"
              className={isSelected ? "employee-card active" : "employee-card"}
              onClick={() => handleEmployeeSelect(employee._id)}
            >
              <strong>{employee.name}</strong>
              <span>{formatINR(employee.monthlySalary)}</span>
              <small>
                Outstanding advance: {formatINR(employee.outstandingAdvance)}
              </small>
            </button>
          );
        })}
      </div>

      <div className="salary-detail-layout">
        <article className="detail-card">
          <div className="detail-card-head">
            <div>
              <h3>{selectedEmployee?.name || "Select an employee"}</h3>
              <p className="muted">
                {selectedEmployee
                  ? "View monthly salary records and add a new salary entry."
                  : "Click an employee card above to see salary details."}
              </p>
            </div>
            {selectedEmployee ? (
              <div className="detail-summary">
                <span>Default</span>
                <strong>
                  {formatINR(
                    selectedEmployee.defaultMonthlySalary ||
                      selectedEmployee.monthlySalary ||
                      0,
                  )}
                </strong>
              </div>
            ) : null}
          </div>

          {selectedEmployee ? (
            <form
              className="form-stack salary-inline-form"
              onSubmit={handleCreateSalary}
            >
              <input type="hidden" value={salaryForm.employeeId} readOnly />
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
                Extra received
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
                {loading ? "Saving..." : "Add salary"}
              </button>
            </form>
          ) : null}
        </article>

        <article className="detail-card">
          <h3>Salary Details</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Monthly Salary</th>
                  <th>Receiving</th>
                  <th>Extra</th>
                  <th>Deduction</th>
                  <th>Advance Left</th>
                </tr>
              </thead>
              <tbody>
                {selectedEmployeeSalaries.length > 0 ? (
                  selectedEmployeeSalaries.map((salary) => (
                    <tr key={salary._id}>
                      <td>{salary.month}</td>
                      <td>{formatINR(salary.monthlySalary)}</td>
                      <td>{formatINR(salary.monthlyReceiving)}</td>
                      <td>{formatINR(salary.extraReceived)}</td>
                      <td>{formatINR(salary.deductionApplied)}</td>
                      <td>{formatINR(salary.outstandingAdvanceAfter)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6">
                      No salary records for this employee yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
