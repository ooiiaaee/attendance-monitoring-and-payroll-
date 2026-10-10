const mongoose = require("mongoose");

const leaveRequestSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    reason: { type: String, required: [true, "Reason is required"] },
    dateFrom: { type: Date, required: true },
    dateTo: { type: Date, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Optional explanation the manager/HR gives when rejecting a request.
    reviewNote: { type: String, trim: true, maxlength: [500, "Note can be at most 500 characters"], default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("LeaveRequest", leaveRequestSchema);
