const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const Session = require("../models/Session");
const ClassSection = require("../models/ClassSection");
const { protect, authorize } = require("../middleware/authMiddleware");

const QR_VALID_MINUTES = 10;

router.post("/", protect, authorize("teacher", "admin"), async (req, res) => {
  try {
    const { classSectionId } = req.body;
    if (!classSectionId) {
      return res.status(400).json({ message: "classSectionId is required" });
    }

    const classSection = await ClassSection.findById(classSectionId);
    if (!classSection) return res.status(404).json({ message: "Class not found" });

    const isOwner = classSection.teacher.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "You don't teach this class" });
    }

    const qrToken = crypto.randomBytes(16).toString("hex");
    const qrExpiresAt = new Date(Date.now() + QR_VALID_MINUTES * 60 * 1000);

    const session = await Session.create({
      classSection: classSectionId,
      date: new Date(),
      qrToken,
      qrExpiresAt,
    });

    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/regenerate-qr", protect, authorize("teacher", "admin"), async (req, res) => {
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

router.get("/class/:classId", protect, async (req, res) => {
  try {
    const sessions = await Session.find({ classSection: req.params.classId }).sort({
      date: -1,
    });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id", protect, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id).populate("classSection", "name");
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
