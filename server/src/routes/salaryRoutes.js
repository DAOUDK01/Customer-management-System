const express = require("express");
const {
  listSalaries,
  listEmployees,
  createEmployee,
  createSalary,
  updateSalaryForMonth,
  deleteEmployee,
} = require("../controllers/salaryController");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(verifyToken);

router.get("/", requireRole("admin"), listSalaries);
router.get("/employees", requireRole("admin"), listEmployees);
router.post("/employees", requireRole("admin"), createEmployee);
router.post("/", requireRole("admin"), createSalary);
router.patch("/:employeeId/:month", requireRole("admin"), updateSalaryForMonth);
router.delete("/:employeeId", requireRole("admin"), deleteEmployee);

module.exports = router;
