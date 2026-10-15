const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // e.g. "user.delete", "user.reset_password"
    targetType: { type: String, required: true }, // e.g. "User", "Department"
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    details: { type: String, default: null }, // short human-readable summary
  },
  { timestamps: true }
);

// Newest first
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
