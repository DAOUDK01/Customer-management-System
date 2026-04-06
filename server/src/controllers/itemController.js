const Item = require("../models/Item");

async function listItems(req, res, next) {
  try {
    const items = await Item.find().sort({ name: 1 });
    return res.json({ items });
  } catch (error) {
    return next(error);
  }
}

async function createItem(req, res, next) {
  try {
    const { name, price, stock } = req.body;

    if (!name || Number.isNaN(Number(price))) {
      return res.status(400).json({ message: "name and price are required" });
    }

    const item = await Item.create({
      name: String(name).trim(),
      price: Number(price),
      stock: Number.isNaN(Number(stock)) ? 0 : Number(stock),
    });

    return res.status(201).json({ item });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Item already exists" });
    }
    return next(error);
  }
}

async function updateItem(req, res, next) {
  try {
    const { id } = req.params;
    const { name, price, stock } = req.body;

    const update = {};
    if (typeof name === "string") {
      update.name = name.trim();
    }
    if (price !== undefined) {
      const parsedPrice = Number(price);
      if (Number.isNaN(parsedPrice)) {
        return res.status(400).json({ message: "Invalid price" });
      }
      update.price = parsedPrice;
    }
    if (stock !== undefined) {
      const parsedStock = Number(stock);
      if (Number.isNaN(parsedStock)) {
        return res.status(400).json({ message: "Invalid stock" });
      }
      update.stock = parsedStock;
    }

    const item = await Item.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    return res.json({ item });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Item name already in use" });
    }
    return next(error);
  }
}

async function deleteItem(req, res, next) {
  try {
    const { id } = req.params;
    const item = await Item.findByIdAndDelete(id);

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    return res.json({ message: "Item deleted" });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listItems,
  createItem,
  updateItem,
  deleteItem,
};
