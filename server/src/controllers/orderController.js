const Order = require("../models/Order");
const XLSX = require("xlsx");

const ORDER_STATUSES = ["processing", "completed", "cancelled"];

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
        status && ORDER_STATUSES.includes(status) ? status : "processing",
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

    if (status && ORDER_STATUSES.includes(status)) {
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

async function listCompletedOrders(req, res, next) {
  try {
    const orders = await Order.find({ status: "completed" }).sort({ createdAt: -1 });
    return res.json({ orders });
  } catch (error) {
    return next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (req.user.role === "admin" && status === "processing") {
      return res
        .status(400)
        .json({ message: "Admin can set only completed or cancelled status" });
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
          status: "completed",
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
            status: "completed",
            createdAt: { $gte: startOfDay },
          },
        },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" } } },
      ]),
      Order.aggregate([
        {
          $match: {
            status: "completed",
            createdAt: { $gte: startOfMonth },
          },
        },
        { $group: { _id: null, revenue: { $sum: "$totalAmount" } } },
      ]),
      Order.aggregate([
        {
          $match: {
            status: "completed",
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
          status: "completed",
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

function getDateLabel(dateValue) {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

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

async function getAdminAnalytics(req, res, next) {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const allOrders = await Order.find().sort({ createdAt: -1 }).lean();
    const completedOrders = allOrders.filter((order) => order.status === "completed");

    const byStatus = {
      processing: 0,
      completed: 0,
      cancelled: 0,
    };

    const last7DailyMap = {};
    const monthItemMap = {};
    const currentMonth = getMonthKey(now);

    allOrders.forEach((order) => {
      if (order.status in byStatus) {
        byStatus[order.status] += 1;
      }

      if (order.status !== "completed") {
        return;
      }

      const createdAt = new Date(order.createdAt);
      if (createdAt >= sevenDaysAgo) {
        const key = getDateLabel(createdAt);
        if (!last7DailyMap[key]) {
          last7DailyMap[key] = { day: key, orders: 0, revenue: 0 };
        }
        last7DailyMap[key].orders += 1;
        last7DailyMap[key].revenue += Number(order.totalAmount || 0);
      }

      if (getMonthKey(createdAt) === currentMonth) {
        (order.items || []).forEach((item) => {
          if (!monthItemMap[item.name]) {
            monthItemMap[item.name] = {
              name: item.name,
              quantity: 0,
              revenue: 0,
            };
          }

          monthItemMap[item.name].quantity += Number(item.quantity || 0);
          monthItemMap[item.name].revenue +=
            Number(item.quantity || 0) * Number(item.price || 0);
        });
      }
    });

    const last7 = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const key = getDateLabel(date);
      last7.push(last7DailyMap[key] || { day: key, orders: 0, revenue: 0 });
    }

    const totalRevenue = completedOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    );

    const topItemsCurrentMonth = Object.values(monthItemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return res.json({
      totalOrders: allOrders.length,
      totalRevenue,
      averageOrderValue:
        completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0,
      byStatus,
      last7,
      currentMonth,
      topItemsCurrentMonth,
    });
  } catch (error) {
    return next(error);
  }
}

async function downloadRevenueExcel(req, res, next) {
  try {
    const { from, to } = req.query;

    let fromDate;
    let toDate;

    if (from && to) {
      fromDate = new Date(from);
      toDate = new Date(to);

      if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ message: "Invalid from/to date" });
      }
      toDate.setHours(23, 59, 59, 999);
    } else {
      const now = new Date();
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
      toDate = new Date(now);
      toDate.setHours(23, 59, 59, 999);
    }

    const orders = await Order.find({
      status: "completed",
      createdAt: { $gte: fromDate, $lte: toDate },
    })
      .sort({ createdAt: 1 })
      .lean();

    const dailyMap = orders.reduce((accumulator, order) => {
      const day = getDateLabel(order.createdAt);
      if (!accumulator[day]) {
        accumulator[day] = { Date: day, CompletedOrders: 0, Revenue: 0 };
      }
      accumulator[day].CompletedOrders += 1;
      accumulator[day].Revenue += Number(order.totalAmount || 0);
      return accumulator;
    }, {});

    const rows = Object.values(dailyMap);
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, "Revenue");

    const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", "attachment; filename=revenue-details.xlsx");

    return res.send(fileBuffer);
  } catch (error) {
    return next(error);
  }
}

async function getTopItemsByMonth(req, res, next) {
  try {
    const month = getMonthKey(req.query.month || new Date());
    if (!month) {
      return res.status(400).json({ message: "month must be YYYY-MM" });
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 0, 23, 59, 59, 999);

    const orders = await Order.find({
      status: "completed",
      createdAt: { $gte: start, $lte: end },
    }).lean();

    const itemMap = {};
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (!itemMap[item.name]) {
          itemMap[item.name] = {
            name: item.name,
            quantity: 0,
            revenue: 0,
          };
        }
        itemMap[item.name].quantity += Number(item.quantity || 0);
        itemMap[item.name].revenue += Number(item.quantity || 0) * Number(item.price || 0);
      });
    });

    const items = Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 15);

    return res.json({ month, items });
  } catch (error) {
    return next(error);
  }
}

async function downloadTopItemsExcel(req, res, next) {
  try {
    const month = getMonthKey(req.query.month || new Date());
    if (!month) {
      return res.status(400).json({ message: "month must be YYYY-MM" });
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const start = new Date(year, monthNumber - 1, 1);
    const end = new Date(year, monthNumber, 0, 23, 59, 59, 999);

    const orders = await Order.find({
      status: "completed",
      createdAt: { $gte: start, $lte: end },
    }).lean();

    const itemMap = {};
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (!itemMap[item.name]) {
          itemMap[item.name] = {
            Item: item.name,
            QuantitySold: 0,
            Revenue: 0,
            Month: month,
          };
        }
        itemMap[item.name].QuantitySold += Number(item.quantity || 0);
        itemMap[item.name].Revenue += Number(item.quantity || 0) * Number(item.price || 0);
      });
    });

    const rows = Object.values(itemMap).sort(
      (a, b) => b.QuantitySold - a.QuantitySold,
    );

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, "TopItems");
    const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename=top-items-${month}.xlsx`);

    return res.send(fileBuffer);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
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
};
