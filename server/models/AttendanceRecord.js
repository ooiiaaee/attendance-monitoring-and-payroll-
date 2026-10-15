const mongoose = require("mongoose");

const attendanceRecordSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", required: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["present", "late", "absent", "excused"],
      default: "present",
    },
    timestamp: { type: Date, default: Date.now },
    checkOutTime: { type: Date, default: null },
    hoursWorked: { type: Number, default: null },
    // Check-in location, distance from the session, and whether it was flagged
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    distanceMeters: { type: Number, default: null },
    flagged: { type: Boolean, default: false },
    flagReason: { type: String, default: null },
    // Soft delete flag
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

attendanceRecordSchema.index({ session: 1, staff: 1 }, { unique: true });
// Index for lookups by staff
attendanceRecordSchema.index({ staff: 1 });

module.exports = mongoose.model("AttendanceRecord", attendanceRecordSchema);
