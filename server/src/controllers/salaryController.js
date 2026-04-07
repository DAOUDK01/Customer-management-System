const Employee = require("../models/Employee");
const Salary = require("../models/Salary");

function getMonthKey(value) {
  if (typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return value;
  }

  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

async function getOutstandingAdvanceBefore(employeeId, month) {
  const records = await Salary.find({ employeeId, month: { $lt: month } }).sort(
    { month: 1, createdAt: 1 },
  );

  return records.reduce(
    (sum, entry) =>
      sum +
      Number(entry.extraReceived || 0) -
      Number(entry.deductionApplied || 0),
    0,
  );
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
      monthlySalary,
      extraReceived = 0,
      name,
      defaultMonthlySalary,
    } = req.body;

    // Handle employee creation
    if (
      !employeeId &&
      name &&
      defaultMonthlySalary !== undefined &&
      defaultMonthlySalary !== ""
    ) {
      const salary = Number(defaultMonthlySalary);
      if (Number.isNaN(salary)) {
        return res
          .status(400)
          .json({ message: "defaultMonthlySalary must be a valid number" });
      }

      const employee = await Employee.create({
        name: String(name).trim(),
        defaultMonthlySalary: salary,
        createdBy: req.user.id,
      });

      return res.status(201).json({ employee });
    }

    // Handle salary record creation
    if (!employeeId || Number.isNaN(Number(monthlySalary))) {
      return res
        .status(400)
        .json({ message: "employeeId and monthlySalary are required" });
    }

    const monthKey = getMonthKey(month);
    if (!monthKey) {
      return res
        .status(400)
        .json({ message: "month must be in YYYY-MM format" });
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
      monthlySalary: parsedMonthlySalary,
      extraReceived: parsedExtraReceived,
      deductionApplied,
      monthlyReceiving,
      outstandingAdvanceAfter,
      createdBy: req.user.id,
    });

    return res.status(201).json({ salary });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "Salary already added for this employee and month" });
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
