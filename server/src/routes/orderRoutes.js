const express = require("express");
const {
  createOrder,
  listOrders,
  listCompletedOrders,
  updateOrderStatus,
  deleteOrder,
  deleteOldOrders,
  getTodayRevenue,
  getAdminRevenueSummary,
  getRevenueByDateRange,
  getAdminAnalytics,
  getTopItemsByMonth,
  downloadRevenueExcel,
  downloadTopItemsExcel,
} = require("../controllers/orderController");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(verifyToken);

router.post("/", requireRole("admin", "manager"), createOrder);
router.get("/", requireRole("admin", "manager"), listOrders);
router.get("/completed", requireRole("admin", "manager"), listCompletedOrders);
router.get("/revenue/today", requireRole("admin", "manager"), getTodayRevenue);
router.get("/revenue/summary", requireRole("admin"), getAdminRevenueSummary);
router.get("/revenue/range", requireRole("admin"), getRevenueByDateRange);
router.get("/analytics", requireRole("admin"), getAdminAnalytics);
router.get("/top-items", requireRole("admin"), getTopItemsByMonth);
router.get("/export/revenue", requireRole("admin"), downloadRevenueExcel);
router.get("/export/top-items", requireRole("admin"), downloadTopItemsExcel);
router.delete("/archive", requireRole("admin"), deleteOldOrders);
router.patch("/:id/status", requireRole("admin", "manager"), updateOrderStatus);
router.delete("/:id", requireRole("admin"), deleteOrder);

module.exports = router;
