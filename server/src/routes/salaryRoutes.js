const express = require("express");
const {
  listSalaries,
  createSalary,
} = require("../controllers/salaryController");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(verifyToken);

router.get("/", requireRole("admin"), listSalaries);
router.post("/", requireRole("admin"), createSalary);

module.exports = router;
