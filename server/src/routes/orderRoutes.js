const express = require("express");
const {
  createOrder,
  listOrders,
  updateOrderStatus,
  deleteOrder,
  deleteOldOrders,
  getTodayRevenue,
  getAdminRevenueSummary,
  getRevenueByDateRange,
} = require("../controllers/orderController");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(verifyToken);

router.post("/", requireRole("admin", "manager"), createOrder);
router.get("/", requireRole("admin", "manager"), listOrders);
router.get("/revenue/today", requireRole("admin", "manager"), getTodayRevenue);
router.get("/revenue/summary", requireRole("admin"), getAdminRevenueSummary);
router.get("/revenue/range", requireRole("admin"), getRevenueByDateRange);
router.delete("/archive", requireRole("admin"), deleteOldOrders);
router.patch("/:id/status", requireRole("admin", "manager"), updateOrderStatus);
router.delete("/:id", requireRole("admin"), deleteOrder);

module.exports = router;
