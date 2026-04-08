import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../api";
import { formatINR } from "../../utils/currency";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentDate() {
  return new Date().toISOString().slice(0, 10);
}

function getEmployeeRecordId(employee) {
  if (employee?._id) {
    return String(employee._id);
  }

  if (employee?.id) {
    return String(employee.id);
  }

  return "";
}

function getMonthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getEmployeeKey(employee) {
  if (employee?._id) {
    return String(employee._id);
  }

  if (employee?.id) {
    return String(employee.id);
  }

  return `legacy-${String(employee?.name || "unknown").toLowerCase()}`;
}

function buildEmployeesFromSalaries(salaryRecords) {
  const map = new Map();

  (salaryRecords || []).forEach((record) => {
    const name = String(record.employeeName || record.name || "").trim();
    if (!name) {
      return;
    }

    const key = String(record.employeeId || `legacy-${name.toLowerCase()}`);
    if (!map.has(key)) {
      map.set(key, {
        _id: key,
        name,
        defaultMonthlySalary: Number(
          record.monthlySalary || record.amount || 0,
        ),
        monthlySalary: Number(record.monthlySalary || record.amount || 0),
        extraReceived: Number(record.extraReceived || 0),
        outstandingAdvance: Number(record.outstandingAdvanceAfter || 0),
      });
      return;
    }

    const existing = map.get(key);
    existing.monthlySalary = Number(
      record.monthlySalary || record.amount || existing.monthlySalary || 0,
    );
    existing.extraReceived = Number(
      record.extraReceived || existing.extraReceived || 0,
    );
    existing.outstandingAdvance = Number(
      record.outstandingAdvanceAfter || existing.outstandingAdvance || 0,
    );
  });

  return Array.from(map.values()).sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || "")),
  );
}

function mergeEmployees(...employeeLists) {
  const map = new Map();

  employeeLists
    .flat()
    .filter(Boolean)
    .forEach((employee) => {
      const key = getEmployeeKey(employee);
      const existing = map.get(key) || {};

      map.set(key, {
        ...existing,
        ...employee,
        _id: employee._id || existing._id || key,
        name: employee.name || existing.name || "",
        defaultMonthlySalary:
          employee.defaultMonthlySalary ?? existing.defaultMonthlySalary ?? 0,
        monthlySalary: employee.monthlySalary ?? existing.monthlySalary ?? 0,
        extraReceived: employee.extraReceived ?? existing.extraReceived ?? 0,
        outstandingAdvance:
          employee.outstandingAdvance ?? existing.outstandingAdvance ?? 0,
      });
    });

  return Array.from(map.values()).sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || "")),
  );
}

function pickArray(payload, preferredKey) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.[preferredKey])) {
    return payload[preferredKey];
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
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
    date: getCurrentDate(),
    monthlySalary: "",
    extraReceived: "0",
  });

  async function loadSalaries() {
    const [salaryResponse, employeesResponse] = await Promise.allSettled([
      apiRequest("/salaries"),
      apiRequest("/salaries/employees"),
    ]);

    if (
      salaryResponse.status === "rejected" &&
      employeesResponse.status === "rejected"
    ) {
      throw new Error(
        salaryResponse.reason?.message || "Failed to load salaries",
      );
    }

    const loadedSalaries =
      salaryResponse.status === "fulfilled"
        ? pickArray(salaryResponse.value, "salaries")
        : [];
    const employeesFromSalaryEndpoint =
      salaryResponse.status === "fulfilled"
        ? pickArray(salaryResponse.value, "employees")
        : [];
    const employeesFromEmployeeEndpoint =
      employeesResponse.status === "fulfilled"
        ? pickArray(employeesResponse.value, "employees")
        : [];

    const salaryDerivedEmployees = buildEmployeesFromSalaries(loadedSalaries);
    const loadedEmployees = mergeEmployees(
      employeesFromEmployeeEndpoint,
      employeesFromSalaryEndpoint,
      salaryDerivedEmployees,
    );

    setSalaries(loadedSalaries);
    setEmployees((current) => mergeEmployees(current, loadedEmployees));

    if (!selectedEmployeeId && loadedEmployees.length > 0) {
      const firstEmployeeId = getEmployeeKey(loadedEmployees[0]);
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
      const selectedEmployeeForSalary = employees.find(
        (employee) =>
          getEmployeeKey(employee) === String(salaryForm.employeeId),
      );
      const resolvedMonthlySalary =
        String(salaryForm.monthlySalary).trim() === ""
          ? Number(
              selectedEmployeeForSalary?.monthlySalary ||
                selectedEmployeeForSalary?.defaultMonthlySalary ||
                0,
            )
          : Number(salaryForm.monthlySalary);

      await apiRequest("/salaries", {
        method: "POST",
        body: JSON.stringify({
          employeeId: getEmployeeRecordId(selectedEmployeeForSalary),
          date: salaryForm.date,
          month: getMonthKey(salaryForm.date) || currentMonth,
          monthlySalary: resolvedMonthlySalary,
          extraReceived: Number(salaryForm.extraReceived || 0),
        }),
      });

      setMessage("Salary saved successfully");
      setSalaryForm({
        employeeId: salaryForm.employeeId,
        date: getCurrentDate(),
        monthlySalary: "",
        extraReceived: "0",
      });
      try {
        await loadSalaries();
      } catch (refreshError) {
        setMessage(
          `Employee added, but refresh failed: ${refreshError.message}`,
        );
      }
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
      const trimmedName = employeeForm.name.trim();
      const salary = Number(employeeForm.defaultMonthlySalary);

      if (!trimmedName) {
        setMessage("Employee name is required");
        setLoading(false);
        return;
      }

      if (Number.isNaN(salary) || salary <= 0) {
        setMessage("Default salary must be a positive number");
        setLoading(false);
        return;
      }

      const payload = {
        name: trimmedName,
        defaultMonthlySalary: salary,
      };

      let createError = null;
      let createdEmployee = null;

      for (const endpoint of ["/salaries/employees", "/salaries"]) {
        try {
          const result = await apiRequest(endpoint, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          createdEmployee = result.employee || null;
          createError = null;
          break;
        } catch (requestError) {
          createError = requestError;

          const errorMessage = String(requestError.message || "").toLowerCase();

          // If a route is missing on one deployment shape, try the fallback endpoint.
          if (
            endpoint === "/salaries/employees" &&
            (errorMessage.includes("route not found") ||
              errorMessage.includes("required") ||
              errorMessage.includes("amount and date"))
          ) {
            continue;
          }

          break;
        }
      }

      if (createError) {
        throw createError;
      }

      if (!createdEmployee) {
        createdEmployee = {
          _id: `local-${trimmedName.toLowerCase().replace(/\s+/g, "-")}`,
          name: trimmedName,
          defaultMonthlySalary: salary,
          monthlySalary: salary,
          extraReceived: 0,
          outstandingAdvance: 0,
        };
      }

      setMessage("Employee added successfully!");
      setEmployeeForm({ name: "", defaultMonthlySalary: "" });

      if (createdEmployee) {
        setEmployees((current) => {
          const exists = current.some(
            (employee) =>
              getEmployeeKey(employee) === getEmployeeKey(createdEmployee),
          );

          if (exists) {
            return current;
          }

          const next = [...current, createdEmployee];
          next.sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || "")),
          );
          return next;
        });
        const createdEmployeeKey = getEmployeeKey(createdEmployee);
        setSelectedEmployeeId(createdEmployeeKey);
        setSalaryForm((current) => ({
          ...current,
          employeeId: createdEmployeeKey,
          monthlySalary: String(
            createdEmployee.defaultMonthlySalary ||
              createdEmployee.monthlySalary ||
              0,
          ),
        }));
      }

      await loadSalaries();
    } catch (requestError) {
      const errorMessage = String(requestError.message || "");

      if (
        errorMessage.includes("employeeId_1_month_1") ||
        (errorMessage.includes("E11000") && errorMessage.includes("month"))
      ) {
        setMessage(
          "Backend attempted to insert an invalid salary record while adding employee. Please restart/redeploy backend and try again.",
        );
      } else if (
        requestError.message
          ?.toLowerCase()
          .includes("employeename, amount and date are required")
      ) {
        setMessage(
          "Your server is using old salary validation for this endpoint. Please redeploy backend with latest salary controller.",
        );
      } else {
        setMessage(requestError.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteEmployee(employeeId) {
    if (
      !window.confirm(
        "Are you sure you want to delete this employee and all their salary records?",
      )
    ) {
      return;
    }

    setMessage("");
    setLoading(true);

    try {
      await apiRequest(`/salaries/${employeeId}`, {
        method: "DELETE",
      });

      setMessage("Employee deleted");
      setSelectedEmployeeId("");
      await loadSalaries();
    } catch (requestError) {
      setMessage(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEmployeeSelect(employeeId) {
    const employee = employees.find(
      (entry) => getEmployeeKey(entry) === String(employeeId),
    );
    setSelectedEmployeeId(employeeId);
    setSalaryForm((current) => ({
      ...current,
      employeeId,
      monthlySalary: employee
        ? String(employee.monthlySalary || employee.defaultMonthlySalary || 0)
        : current.monthlySalary,
      date: current.date || getCurrentDate(),
    }));
  }

  const selectedEmployee = useMemo(
    () =>
      employees.find(
        (employee) => getEmployeeKey(employee) === String(selectedEmployeeId),
      ),
    [employees, selectedEmployeeId],
  );

  const selectedEmployeeRecordId = useMemo(
    () => getEmployeeRecordId(selectedEmployee),
    [selectedEmployee],
  );

  const selectedEmployeeSalaries = useMemo(
    () =>
      salaries.filter(
        (salary) =>
          (selectedEmployeeRecordId &&
            String(salary.employeeId) === String(selectedEmployeeRecordId)) ||
          salary.employeeName === selectedEmployee?.name,
      ),
    [salaries, selectedEmployeeRecordId, selectedEmployee],
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

      {!selectedEmployeeRecordId && selectedEmployee ? (
        <p className="muted">
          This employee is from legacy data and cannot receive new salary
          entries until a backend-linked employee record exists.
        </p>
      ) : null}

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
          const employeeKey = getEmployeeKey(employee);
          const isSelected = employeeKey === String(selectedEmployeeId);

          return (
            <div key={employeeKey} className="employee-card-wrapper">
              <button
                type="button"
                className={
                  isSelected ? "employee-card active" : "employee-card"
                }
                onClick={() => handleEmployeeSelect(employeeKey)}
              >
                <strong>{employee.name}</strong>
                <span>{formatINR(employee.monthlySalary)}</span>
                <small>
                  Extra this month: {formatINR(employee.extraReceived || 0)}
                </small>
                <small>
                  Outstanding advance: {formatINR(employee.outstandingAdvance)}
                </small>
              </button>
              <button
                type="button"
                className="delete-btn-small"
                onClick={() => handleDeleteEmployee(employee._id)}
                title="Delete employee"
                disabled={loading}
              >
                ✕
              </button>
            </div>
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

          <form
            className="form-stack salary-inline-form"
            onSubmit={handleCreateSalary}
          >
            <label>
              Employee
              <select
                value={salaryForm.employeeId}
                onChange={(event) => handleEmployeeSelect(event.target.value)}
                required
                disabled={employees.length === 0}
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option
                    key={getEmployeeKey(employee)}
                    value={getEmployeeKey(employee)}
                  >
                    {employee.name}
                  </option>
                ))}
              </select>
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
              <small className="muted">
                The app stores salary records by month, but you can pick the
                actual date here.
              </small>
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
                placeholder="Leave empty to use employee default"
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
              <small className="muted">
                Extra received means advance taken by employee.
              </small>
            </label>
            <button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Add salary"}
            </button>
            {employees.length === 0 ? (
              <p className="muted">
                Add an employee first, then choose the employee and salary date.
              </p>
            ) : null}
          </form>
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
