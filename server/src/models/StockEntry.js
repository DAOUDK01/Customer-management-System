const mongoose = require("mongoose");

const stockEntrySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      default: "kg",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("StockEntry", stockEntrySchema);
