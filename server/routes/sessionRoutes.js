const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const Session = require("../models/Session");
const Department = require("../models/Department");
const { protect, authorize } = require("../middleware/authMiddleware");

const QR_VALID_MINUTES = 10;

router.post("/", protect, authorize("manager", "hr"), async (req, res) => {
  try {
    const { departmentId, lat, lng } = req.body;
    if (!departmentId) {
      return res.status(400).json({ message: "departmentId is required" });
    }

    const department = await Department.findById(departmentId);
    if (!department) return res.status(404).json({ message: "Department not found" });

    const isOwner = department.manager.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "hr") {
      return res.status(403).json({ message: "You don't manage this department" });
    }

    const qrToken = crypto.randomBytes(16).toString("hex");
    const qrExpiresAt = new Date(Date.now() + QR_VALID_MINUTES * 60 * 1000);

    const session = await Session.create({
      department: departmentId,
      date: new Date(),
      qrToken,
      qrExpiresAt,
      location:
        typeof lat === "number" && typeof lng === "number" ? { lat, lng } : { lat: null, lng: null },
    });

    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/regenerate-qr", protect, authorize("manager", "hr"), async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    session.qrToken = crypto.randomBytes(16).toString("hex");
    session.qrExpiresAt = new Date(Date.now() + QR_VALID_MINUTES * 60 * 1000);
    await session.save();

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/department/:departmentId", protect, async (req, res) => {
  try {
    const sessions = await Session.find({ department: req.params.departmentId }).sort({
      date: -1,
    });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id", protect, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id).populate("department", "name");
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
