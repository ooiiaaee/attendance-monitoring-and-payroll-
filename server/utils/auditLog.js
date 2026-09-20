const AuditLog = require("../models/AuditLog");

/**
 * Records an audit entry. Never throws — a logging failure should never
 * break the action that triggered it.
 */
async function logAudit(actorId, action, targetType, targetId, details) {
  try {
    await AuditLog.create({ actor: actorId, action, targetType, targetId, details });
  } catch (error) {
    console.error("[audit] Failed to record audit entry:", error.message);
  }
}

module.exports = { logAudit };
