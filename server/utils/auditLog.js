const AuditLog = require("../models/AuditLog");

// Records an audit entry; never throws
async function logAudit(actorId, action, targetType, targetId, details) {
  try {
    await AuditLog.create({ actor: actorId, action, targetType, targetId, details });
  } catch (error) {
    console.error("[audit] Failed to record audit entry:", error.message);
  }
}

module.exports = { logAudit };
