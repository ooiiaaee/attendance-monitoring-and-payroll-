const express = require("express");
const router = express.Router();
const AttendanceRecord = require("../models/AttendanceRecord");
const Session = require("../models/Session");
const ClassSection = require("../models/ClassSection");
const { protect, authorize } = require("../middleware/authMiddleware");

// STUDENT CHECK-IN via QR scan
router.post("/checkin", protect, authorize("student"), async (req, res) => {
  try {
    const { qrToken } = req.body;
    if (!qrToken) return res.status(400).json({ message: "qrToken is required" });

    const session = await Session.findOne({ qrToken });
    if (!session) return res.status(404).json({ message: "Invalid QR code" });

    if (session.qrExpiresAt < new Date()) {
      return res.status(400).json({ message: "This QR code has expired" });
    }

    const classSection = await ClassSection.findById(session.classSection);
    const isEnrolled = classSection.students.some(
      (studentId) => studentId.toString() === req.user._id.toString()
    );
    if (!isEnrolled) {
      return res.status(403).json({ message: "You are not enrolled in this class" });
    }

    const existing = await AttendanceRecord.findOne({
      session: session._id,
      student: req.user._id,
    });
    if (existing) {
      return res.status(400).json({ message: "Attendance already recorded for this session" });
    }

    const record = await AttendanceRecord.create({
      session: session._id,
      student: req.user._id,
      status: "present",
      timestamp: new Date(),
    });

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// TEACHER/ADMIN manual override — mark a student's status directly
router.post("/manual", protect, authorize("teacher", "admin"), async (req, res) => {
  try {
    const { sessionId, studentId, status } = req.body;
    if (!sessionId || !studentId || !status) {
      return res.status(400).json({ message: "sessionId, studentId, and status are required" });
    }

    const record = await AttendanceRecord.findOneAndUpdate(
      { session: sessionId, student: studentId },
      { status, timestamp: new Date() },
      { upsert: true, new: true, runValidators: true }
    );

    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// TEACHER/ADMIN removes a record — useful for corrections or clearing a test check-in
router.delete("/:id", protect, authorize("teacher", "admin"), async (req, res) => {
  try {
    const deleted = await AttendanceRecord.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Record not found" });
    res.json({ message: "Attendance record removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET attendance records for a specific session (teacher's roster view)
router.get("/session/:sessionId", protect, async (req, res) => {
  try {
    const records = await AttendanceRecord.find({ session: req.params.sessionId }).populate(
      "student",
      "name email studentId"
    );
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET a student's own attendance history
router.get("/student/:studentId", protect, async (req, res) => {
  try {
    if (req.user.role === "student" && req.user._id.toString() !== req.params.studentId) {
      return res.status(403).json({ message: "You can only view your own attendance" });
    }

    const records = await AttendanceRecord.find({ student: req.params.studentId })
      .populate({ path: "session", populate: { path: "classSection", select: "name" } })
      .sort({ timestamp: -1 });

    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
