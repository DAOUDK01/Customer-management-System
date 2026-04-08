const Employee = require("../models/Employee");
const Salary = require("../models/Salary");

function getMonthKey(value) {
  if (typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return value;
  }

  if (
    typeof value === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)
  ) {
    return value.slice(0, 7);
  }

  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getDateKey(value) {
  if (
    typeof value === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)
  ) {
    return value;
  }

  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

async function getOutstandingAdvanceBefore(employeeId, month) {
  const latestRecord = await Salary.findOne({
    employeeId,
    month: { $lt: month },
  })
    .sort({ month: -1, createdAt: -1 })
    .lean();

  const latestOutstanding = Number(latestRecord?.outstandingAdvanceAfter);
  if (!Number.isNaN(latestOutstanding) && latestOutstanding > 0) {
    return latestOutstanding;
  }

  const records = await Salary.find({ employeeId, month: { $lt: month } })
    .select("extraReceived deductionApplied")
    .lean();

  const outstanding = records.reduce(
    (sum, entry) =>
      sum +
      Number(entry.extraReceived || 0) -
      Number(entry.deductionApplied || 0),
    0,
  );

  return Math.max(0, outstanding);
}

async function listSalaries(req, res, next) {
  try {
    const salaries = await Salary.find()
      .sort({ month: -1, createdAt: -1 })
      .lean();

    const employees = await Employee.find().sort({ name: 1 }).lean();
    const currentMonth = getMonthKey(new Date());

    const salariesByEmployee = salaries.reduce((accumulator, record) => {
      const key = String(record.employeeId);
      if (!accumulator[key]) {
        accumulator[key] = [];
      }
      accumulator[key].push(record);
      return accumulator;
    }, {});

    const employeeSummaries = employees.map((employee) => {
      const records = salariesByEmployee[String(employee._id)] || [];
      const currentMonthRecord = records.find(
        (record) => record.month === currentMonth,
      );
      const latestRecord = records[0];

      return {
        _id: employee._id,
        name: employee.name,
        defaultMonthlySalary: employee.defaultMonthlySalary,
        currentMonth,
        monthlySalary:
          currentMonthRecord?.monthlySalary ??
          latestRecord?.monthlySalary ??
          employee.defaultMonthlySalary,
        monthlyReceiving: currentMonthRecord?.monthlyReceiving ?? 0,
        extraReceived: currentMonthRecord?.extraReceived ?? 0,
        outstandingAdvance: latestRecord?.outstandingAdvanceAfter ?? 0,
      };
    });

    return res.json({ salaries, employees: employeeSummaries });
  } catch (error) {
    return next(error);
  }
}

async function listEmployees(req, res, next) {
  try {
    const employees = await Employee.find().sort({ name: 1 });
    return res.json({ employees });
  } catch (error) {
    return next(error);
  }
}

async function createEmployee(req, res, next) {
  try {
    const { name, defaultMonthlySalary } = req.body;

    if (!name || Number.isNaN(Number(defaultMonthlySalary))) {
      return res
        .status(400)
        .json({ message: "name and defaultMonthlySalary are required" });
    }

    const employee = await Employee.create({
      name: String(name).trim(),
      defaultMonthlySalary: Number(defaultMonthlySalary),
      createdBy: req.user.id,
    });

    return res.status(201).json({ employee });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Employee already exists" });
    }
    return next(error);
  }
}

async function createSalary(req, res, next) {
  try {
    const {
      employeeId,
      month,
      date,
      monthlySalary,
      extraReceived = 0,
      name,
      defaultMonthlySalary,
    } = req.body;

    console.log("createSalary received:", {
      employeeId,
      month,
      date,
      monthlySalary,
      name,
      defaultMonthlySalary,
    });

    // Handle employee creation
    // Employee creation: if name and defaultMonthlySalary are provided, no employeeId
    if (
      name &&
      defaultMonthlySalary !== undefined &&
      defaultMonthlySalary !== ""
    ) {
      if (!employeeId) {
        // This is employee creation mode
        const salary = Number(defaultMonthlySalary);
        console.log("Creating employee with:", { name, salary });

        if (Number.isNaN(salary) || salary <= 0) {
          return res.status(400).json({
            message: "defaultMonthlySalary must be a valid positive number",
          });
        }

        const employee = await Employee.create({
          name: String(name).trim(),
          defaultMonthlySalary: salary,
          createdBy: req.user.id,
        });

        console.log("Employee created:", employee._id);
        return res.status(201).json({ employee });
      }
    }

    // Handle salary record creation
    const monthKey = getMonthKey(month || date);
    const dateKey = getDateKey(date || `${monthKey}-01`);

    if (!employeeId || !monthKey || !dateKey || monthlySalary === undefined) {
      return res.status(400).json({
        message:
          "employeeId, monthlySalary, and a valid date/month are required",
      });
    }

    if (Number.isNaN(Number(monthlySalary)) || Number(monthlySalary) < 0) {
      return res
        .status(400)
        .json({ message: "monthlySalary must be a valid positive number" });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const parsedMonthlySalary = Number(monthlySalary);
    const parsedExtraReceived = Number(extraReceived);

    if (
      Number.isNaN(parsedMonthlySalary) ||
      parsedMonthlySalary < 0 ||
      Number.isNaN(parsedExtraReceived) ||
      parsedExtraReceived < 0
    ) {
      return res.status(400).json({
        message:
          "monthlySalary and extraReceived must be valid positive numbers",
      });
    }

    const outstandingBefore = await getOutstandingAdvanceBefore(
      employee._id,
      monthKey,
    );
    const existingSalary = await Salary.findOne({
      employeeId: employee._id,
      month: monthKey,
    });

    if (existingSalary) {
      const updatedMonthlySalary = parsedMonthlySalary;
      const updatedExtraReceived =
        Number(existingSalary.extraReceived || 0) + parsedExtraReceived;
      const updatedExtraHistory = Array.isArray(existingSalary.extraHistory)
        ? [...existingSalary.extraHistory]
        : [];

      if (parsedExtraReceived > 0) {
        updatedExtraHistory.push({
          date: dateKey,
          amount: parsedExtraReceived,
        });
      }

      const deductionApplied = Math.min(
        Math.max(outstandingBefore, 0),
        updatedMonthlySalary,
      );
      const monthlyReceiving =
        updatedMonthlySalary - deductionApplied + updatedExtraReceived;
      const outstandingAdvanceAfter = Math.max(
        0,
        outstandingBefore - deductionApplied + updatedExtraReceived,
      );

      existingSalary.employeeName = employee.name;
      existingSalary.recordDate = dateKey;
      existingSalary.monthlySalary = updatedMonthlySalary;
      existingSalary.extraReceived = updatedExtraReceived;
      existingSalary.extraHistory = updatedExtraHistory;
      existingSalary.deductionApplied = deductionApplied;
      existingSalary.monthlyReceiving = monthlyReceiving;
      existingSalary.outstandingAdvanceAfter = outstandingAdvanceAfter;
      await existingSalary.save();

      return res.json({
        salary: existingSalary,
        message: "Salary for this month updated with extra amount",
      });
    }

    const deductionApplied = Math.min(
      Math.max(outstandingBefore, 0),
      parsedMonthlySalary,
    );
    const monthlyReceiving =
      parsedMonthlySalary - deductionApplied + parsedExtraReceived;
    const outstandingAdvanceAfter = Math.max(
      0,
      outstandingBefore - deductionApplied + parsedExtraReceived,
    );

    const salary = await Salary.create({
      employeeId: employee._id,
      employeeName: employee.name,
      month: monthKey,
      recordDate: dateKey,
      monthlySalary: parsedMonthlySalary,
      extraReceived: parsedExtraReceived,
      extraHistory:
        parsedExtraReceived > 0
          ? [{ date: dateKey, amount: parsedExtraReceived }]
          : [],
      deductionApplied,
      monthlyReceiving,
      outstandingAdvanceAfter,
      createdBy: req.user.id,
    });

    return res.status(201).json({ salary });
  } catch (error) {
    console.error("createSalary error:", error.message);
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "Salary already added for this employee and month" });
    }
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return res.status(400).json({ message: messages });
    }
    return next(error);
  }
}

async function deleteEmployee(req, res, next) {
  try {
    const { employeeId } = req.params;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Delete all salary records associated with this employee
    await Salary.deleteMany({ employeeId });

    // Delete the employee
    await Employee.findByIdAndDelete(employeeId);

    return res.json({ message: "Employee and their salary records deleted" });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listSalaries,
  listEmployees,
  createEmployee,
  createSalary,
  deleteEmployee,
};
