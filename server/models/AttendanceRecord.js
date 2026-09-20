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
    // Anti-buddy-punching: the staff device's location at check-in, its
    // distance from the session's location, and whether that distance (or
    // a missing location) was suspicious enough to flag for manager review.
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    distanceMeters: { type: Number, default: null },
    flagged: { type: Boolean, default: false },
    flagReason: { type: String, default: null },
  },
  { timestamps: true }
);

attendanceRecordSchema.index({ session: 1, staff: 1 }, { unique: true });

module.exports = mongoose.model("AttendanceRecord", attendanceRecordSchema);
