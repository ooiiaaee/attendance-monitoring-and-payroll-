const mongoose = require("mongoose");

// A manually-recorded payment to a staff member (or manager) — "we paid
// this person this amount for this period" — rather than anything derived
// from logged hours. The hours-based summary (GET /departments/:id/payroll)
// still exists separately as optional reference info; this is the actual
// record of what was paid.
const payrollPaymentSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    amount: { type: Number, required: true, min: 0 },
    // The pay period this payment covers — just for grouping/labeling, not
    // used to calculate the amount.
    periodFrom: { type: Date, required: true },
    periodTo: { type: Date, required: true },
    note: { type: String, default: "" },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    paidAt: { type: Date, default: Date.now },
    // Soft delete, same pattern as the rest of the app — a bad entry gets
    // hidden from totals/history rather than erased outright.
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

payrollPaymentSchema.index({ department: 1, paidAt: -1 });
payrollPaymentSchema.index({ staff: 1 });

module.exports = mongoose.model("PayrollPayment", payrollPaymentSchema);
