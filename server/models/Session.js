const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    classSection: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSection", required: true },
    date: { type: Date, default: Date.now },
    qrToken: { type: String, required: true },
    qrExpiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
