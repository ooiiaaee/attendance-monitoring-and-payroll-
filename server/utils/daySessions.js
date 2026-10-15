const Session = require("../models/Session");
const { dayBounds } = require("./dayKey");

// The active session a department has for a given day, or null
async function findDaySession(departmentId, key) {
  const { start, end } = dayBounds(key);
  return Session.findOne({
    department: departmentId,
    isActive: { $ne: false },
    $or: [{ dayKey: key }, { dayKey: null, date: { $gte: start, $lte: end } }],
  }).sort({ date: 1 });
}

module.exports = { findDaySession };
