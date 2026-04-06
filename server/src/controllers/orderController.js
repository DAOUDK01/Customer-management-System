const Order = require("../models/Order");

function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function getStartAndEndOfDay(referenceDate = new Date()) {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

async function createOrder(req, res, next) {
  try {
    const { items, status } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Items are required" });
    }

    const normalizedItems = items.map((item) => ({
      name: String(item.name || "").trim(),
      price: Number(item.price),
      quantity: Number(item.quantity),
    }));

    if (
      normalizedItems.some(
        (item) =>
          !item.name || Number.isNaN(item.price) || Number.isNaN(item.quantity),
      )
    ) {
      return res
        .status(400)
        .json({ message: "Each item needs a name, price, and quantity" });
    }

    const totalAmount = calculateTotal(normalizedItems);

    const order = await Order.create({
      items: normalizedItems,
      totalAmount,
      status:
        status && ["processing", "completed", "incomplete"].includes(status)
          ? status
          : "processing",
      createdBy: req.user.id,
    });

    return res.status(201).json({ order });
  } catch (error) {
    return next(error);
  }
}

async function listOrders(req, res, next) {
  try {
    const { status } = req.query;
    const query = {};

    if (status && ["processing", "completed", "incomplete"].includes(status)) {
      query.status = status;
    }

    if (req.user.role === "manager") {
      const { start, end } = getStartAndEndOfDay();
      query.createdAt = { $gte: start, $lte: end };
    }

    const orders = await Order.find(query).sort({ createdAt: -1 });

    return res.json({ orders });
  } catch (error) {
    return next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["processing", "completed", "incomplete"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.status = status;
    await order.save();

    return res.json({ order });
  } catch (error) {
    return next(error);
  }
}

async function deleteOrder(req, res, next) {
  try {
    const { id } = req.params;
    const order = await Order.findByIdAndDelete(id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    return res.json({ message: "Order deleted" });
  } catch (error) {
    return next(error);
  }
}

async function deleteOldOrders(req, res, next) {
  try {
    const { before } = req.query;

    if (!before) {
      return res.status(400).json({ message: "before is required" });
    }

    const beforeDate = new Date(before);

    if (Number.isNaN(beforeDate.getTime())) {
      return res.status(400).json({ message: "Invalid before date" });
    }

    const result = await Order.deleteMany({ createdAt: { $lt: beforeDate } });

    return res.json({
      message: "Old orders deleted",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return next(error);
  }
}

async function getTodayRevenue(req, res, next) {
  try {
    const { start, end } = getStartAndEndOfDay();

    const [summary] = await Order.aggregate([
      {
        $match: {
          status: { $ne: "incomplete" },
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
    ]);

    return res.json({
      revenue: summary?.revenue || 0,
      orders: summary?.orders || 0,
    });
  } catch (error) {
    return next(error);
  }
}

async function getAdminRevenueSummary(req, res, next) {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [daily, monthly, yearly] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            status: { $ne: "incomplete" },
            createdAt: { $gte: startOfDay },
          },
        },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" } } },
      ]),
      Order.aggregate([
        {
          $match: {
            status: { $ne: "incomplete" },
            createdAt: { $gte: startOfMonth },
          },
        },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" } } },
      ]),
      Order.aggregate([
        {
          $match: {
            status: { $ne: "incomplete" },
            createdAt: { $gte: startOfYear },
          },
        },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" } } },
      ]),
    ]);

    return res.json({
      dailyRevenue: daily[0]?.revenue || 0,
      monthlyRevenue: monthly[0]?.revenue || 0,
      yearlyRevenue: yearly[0]?.revenue || 0,
    });
  } catch (error) {
    return next(error);
  }
}

async function getRevenueByDateRange(req, res, next) {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ message: "from and to date parameters are required" });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    toDate.setHours(23, 59, 59, 999);

    const [summary] = await Order.aggregate([
      {
        $match: {
          status: { $ne: "incomplete" },
          createdAt: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
    ]);

    return res.json({
      revenue: summary?.revenue || 0,
      orders: summary?.orders || 0,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createOrder,
  listOrders,
  updateOrderStatus,
  deleteOrder,
  deleteOldOrders,
  getTodayRevenue,
  getAdminRevenueSummary,
  getRevenueByDateRange,
};
