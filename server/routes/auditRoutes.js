const express = require("express");
const router = express.Router();
const AuditLog = require("../models/AuditLog");
const { protect, authorize } = require("../middleware/authMiddleware");

// GET the audit trail — HR only. Supports optional filtering by action or
// target type, and simple pagination.
router.get("/", protect, authorize("hr"), async (req, res) => {
  try {
    const { action, targetType, limit = 100, page = 1 } = req.query;

    const query = {};
    if (action) query.action = action;
    if (targetType) query.targetType = targetType;

    const entries = await AuditLog.find(query)
      .populate("actor", "name email role")
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await AuditLog.countDocuments(query);

    res.json({ entries, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
