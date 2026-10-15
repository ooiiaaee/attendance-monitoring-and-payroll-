const mongoose = require("mongoose");

// One meeting block, e.g. { day: "Mon", startTime: "09:00", endTime: "10:30" }
const scheduleBlockSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      required: true,
    },
    startTime: { type: String, required: true }, // "HH:MM", 24-hour
    endTime: { type: String, required: true },
  },
  { _id: false }
);

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Department name is required"], trim: true },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    staff: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    schedule: { type: [scheduleBlockSchema], default: [] },
    // Soft delete flag
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Department", departmentSchema);
