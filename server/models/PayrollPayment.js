const mongoose = require("mongoose");

// A manually recorded payment to a staff member or manager
const payrollPaymentSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    amount: { type: Number, required: true, min: 0 },
    // Pay period covered, for labeling only
    periodFrom: { type: Date, required: true },
    periodTo: { type: Date, required: true },
    note: { type: String, default: "" },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    paidAt: { type: Date, default: Date.now },
    // Soft delete
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

payrollPaymentSchema.index({ department: 1, paidAt: -1 });
payrollPaymentSchema.index({ staff: 1 });

module.exports = mongoose.model("PayrollPayment", payrollPaymentSchema);
