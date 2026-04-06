const Salary = require("../models/Salary");

async function listSalaries(req, res, next) {
  try {
    const salaries = await Salary.find().sort({ date: -1, createdAt: -1 });
    return res.json({ salaries });
  } catch (error) {
    return next(error);
  }
}

async function createSalary(req, res, next) {
  try {
    const { employeeName, amount, date } = req.body;

    if (!employeeName || Number.isNaN(Number(amount)) || !date) {
      return res
        .status(400)
        .json({ message: "employeeName, amount and date are required" });
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const salary = await Salary.create({
      employeeName: String(employeeName).trim(),
      amount: Number(amount),
      date: parsedDate,
      createdBy: req.user.id,
    });

    return res.status(201).json({ salary });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listSalaries,
  createSalary,
};
