const express = require("express");
const {
  listSalaries,
  listEmployees,
  createEmployee,
  createSalary,
} = require("../controllers/salaryController");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(verifyToken);

router.get("/", requireRole("admin"), listSalaries);
router.get("/employees", requireRole("admin"), listEmployees);
router.post("/employees", requireRole("admin"), createEmployee);
router.post("/", requireRole("admin"), createSalary);

module.exports = router;
