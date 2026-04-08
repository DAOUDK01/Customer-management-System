const mongoose = require("mongoose");

const salarySchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    employeeName: {
      type: String,
      required: true,
      trim: true,
    },
    month: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    recordDate: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
    },
    monthlySalary: {
      type: Number,
      required: true,
      min: 0,
    },
    extraReceived: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    deductionApplied: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    monthlyReceiving: {
      type: Number,
      required: true,
      min: 0,
    },
    outstandingAdvanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    extraHistory: [
      {
        date: {
          type: String,
          required: true,
          match: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
        },
        at: {
          type: Date,
          required: true,
          default: Date.now,
        },
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

salarySchema.index({ employeeId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("Salary", salarySchema);
