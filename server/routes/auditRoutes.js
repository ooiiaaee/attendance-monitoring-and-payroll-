const express = require("express");
const router = express.Router();
const AuditLog = require("../models/AuditLog");
const { protect, authorize } = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");

// Audit trail (HR only), with optional filters and pagination
router.get(
  "/",
  protect,
  authorize("hr"),
  asyncHandler(async (req, res) => {
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
  })
);

module.exports = router;
