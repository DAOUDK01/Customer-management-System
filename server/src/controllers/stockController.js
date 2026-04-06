const StockEntry = require("../models/StockEntry");

async function listStockEntries(req, res, next) {
  try {
    const entries = await StockEntry.find().sort({ name: 1 });
    return res.json({ entries });
  } catch (error) {
    return next(error);
  }
}

async function createStockEntry(req, res, next) {
  try {
    const { name, quantity, unit } = req.body;

    if (!name || Number.isNaN(Number(quantity)) || !unit) {
      return res
        .status(400)
        .json({ message: "name, quantity and unit are required" });
    }

    const entry = await StockEntry.create({
      name: String(name).trim(),
      quantity: Number(quantity),
      unit: String(unit).trim(),
    });

    return res.status(201).json({ entry });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Stock item already exists" });
    }
    return next(error);
  }
}

async function updateStockEntry(req, res, next) {
  try {
    const { id } = req.params;
    const { quantity, unit } = req.body;

    const update = {};

    if (quantity !== undefined) {
      const parsedQuantity = Number(quantity);
      if (Number.isNaN(parsedQuantity)) {
        return res.status(400).json({ message: "Invalid quantity" });
      }
      update.quantity = parsedQuantity;
    }

    if (unit !== undefined) {
      update.unit = String(unit).trim();
    }

    const entry = await StockEntry.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!entry) {
      return res.status(404).json({ message: "Stock item not found" });
    }

    return res.json({ entry });
  } catch (error) {
    return next(error);
  }
}

async function deleteStockEntry(req, res, next) {
  try {
    const { id } = req.params;
    const entry = await StockEntry.findByIdAndDelete(id);

    if (!entry) {
      return res.status(404).json({ message: "Stock item not found" });
    }

    return res.json({ message: "Stock item deleted" });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listStockEntries,
  createStockEntry,
  updateStockEntry,
  deleteStockEntry,
};
