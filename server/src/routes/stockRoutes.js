const express = require("express");
const {
  listStockEntries,
  createStockEntry,
  updateStockEntry,
  deleteStockEntry,
} = require("../controllers/stockController");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(verifyToken);

router.get("/", requireRole("admin", "manager"), listStockEntries);
router.post("/", requireRole("admin", "manager"), createStockEntry);
router.patch("/:id", requireRole("admin", "manager"), updateStockEntry);
router.delete("/:id", requireRole("admin", "manager"), deleteStockEntry);

module.exports = router;
