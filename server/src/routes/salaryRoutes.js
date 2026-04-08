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

router.get("/", requireRole("admin", "manager"), listSalaries);
router.get("/employees", requireRole("admin", "manager"), listEmployees);
router.post("/employees", requireRole("admin", "manager"), createEmployee);
router.post("/", requireRole("admin", "manager"), createSalary);
router.patch(
  "/:employeeId/:month",
  requireRole("admin", "manager"),
  updateSalaryForMonth,
);
router.delete("/:employeeId", requireRole("admin", "manager"), deleteEmployee);

module.exports = router;
