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

    const hasMonthlySalaryInput =
      monthlySalary !== undefined && String(monthlySalary).trim() !== "";

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

    if (!employeeId || !monthKey || !dateKey) {
      return res.status(400).json({
        message: "employeeId and a valid date/month are required",
      });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const parsedMonthlySalary = hasMonthlySalaryInput
      ? Number(monthlySalary)
      : Number(employee.defaultMonthlySalary || 0);
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

    const saveOrUpdateSalary = async (salaryDoc) => {
      const updatedMonthlySalary = hasMonthlySalaryInput
        ? parsedMonthlySalary
        : Number(salaryDoc.monthlySalary || employee.defaultMonthlySalary || 0);
      const updatedExtraReceived =
        Number(salaryDoc.extraReceived || 0) + parsedExtraReceived;
      const updatedExtraHistory = Array.isArray(salaryDoc.extraHistory)
        ? [...salaryDoc.extraHistory]
        : [];

      if (parsedExtraReceived > 0) {
        updatedExtraHistory.push({
          date: dateKey,
          at: new Date(),
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

      salaryDoc.employeeName = employee.name;
      salaryDoc.recordDate = dateKey;
      salaryDoc.monthlySalary = updatedMonthlySalary;
      salaryDoc.extraReceived = updatedExtraReceived;
      salaryDoc.extraHistory = updatedExtraHistory;
      salaryDoc.deductionApplied = deductionApplied;
      salaryDoc.monthlyReceiving = monthlyReceiving;
      salaryDoc.outstandingAdvanceAfter = outstandingAdvanceAfter;
      await salaryDoc.save();

      return salaryDoc;
    };

    if (existingSalary) {
      const updatedSalary = await saveOrUpdateSalary(existingSalary);

      return res.json({
        salary: updatedSalary,
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

    let salary;

    try {
      salary = await Salary.create({
        employeeId: employee._id,
        employeeName: employee.name,
        month: monthKey,
        recordDate: dateKey,
        monthlySalary: parsedMonthlySalary,
        extraReceived: parsedExtraReceived,
        extraHistory:
          parsedExtraReceived > 0
            ? [{ date: dateKey, at: new Date(), amount: parsedExtraReceived }]
            : [],
        deductionApplied,
        monthlyReceiving,
        outstandingAdvanceAfter,
        createdBy: req.user.id,
      });
    } catch (createError) {
      if (createError.code === 11000) {
        const duplicateMonthSalary = await Salary.findOne({
          employeeId: employee._id,
          month: monthKey,
        });

        if (duplicateMonthSalary) {
          const updatedSalary = await saveOrUpdateSalary(duplicateMonthSalary);
          return res.json({
            salary: updatedSalary,
            message: "Salary for this month updated with extra amount",
          });
        }
      }

      throw createError;
    }

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

async function updateSalaryForMonth(req, res, next) {
  try {
    const { employeeId, month } = req.params;
    const { date, monthlySalary, extraReceived = 0 } = req.body;

    const hasMonthlySalaryInput =
      monthlySalary !== undefined && String(monthlySalary).trim() !== "";

    const monthKey = getMonthKey(month);
    const dateKey = getDateKey(date || `${monthKey}-01`);

    if (!employeeId || !monthKey || !dateKey) {
      return res.status(400).json({
        message: "employeeId, month and valid date are required",
      });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const parsedMonthlySalary = hasMonthlySalaryInput
      ? Number(monthlySalary)
      : Number(employee.defaultMonthlySalary || 0);
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

    const salary = await Salary.findOne({ employeeId, month: monthKey });
    if (!salary) {
      return res
        .status(404)
        .json({ message: "Salary record not found for this month" });
    }

    const outstandingBefore = await getOutstandingAdvanceBefore(
      employee._id,
      monthKey,
    );

    const updatedExtraReceived =
      Number(salary.extraReceived || 0) + parsedExtraReceived;
    const updatedExtraHistory = Array.isArray(salary.extraHistory)
      ? [...salary.extraHistory]
      : [];

    if (parsedExtraReceived > 0) {
      updatedExtraHistory.push({
        date: dateKey,
        at: new Date(),
        amount: parsedExtraReceived,
      });
    }

    const effectiveMonthlySalary = hasMonthlySalaryInput
      ? parsedMonthlySalary
      : Number(salary.monthlySalary || employee.defaultMonthlySalary || 0);

    const deductionApplied = Math.min(
      Math.max(outstandingBefore, 0),
      effectiveMonthlySalary,
    );
    const monthlyReceiving =
      effectiveMonthlySalary - deductionApplied + updatedExtraReceived;
    const outstandingAdvanceAfter = Math.max(
      0,
      outstandingBefore - deductionApplied + updatedExtraReceived,
    );

    salary.employeeName = employee.name;
    salary.recordDate = dateKey;
    salary.monthlySalary = effectiveMonthlySalary;
    salary.extraReceived = updatedExtraReceived;
    salary.extraHistory = updatedExtraHistory;
    salary.deductionApplied = deductionApplied;
    salary.monthlyReceiving = monthlyReceiving;
    salary.outstandingAdvanceAfter = outstandingAdvanceAfter;
    await salary.save();

    return res.json({
      salary,
      message: "Salary for this month updated with extra amount",
    });
  } catch (error) {
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
  updateSalaryForMonth,
  deleteEmployee,
};
