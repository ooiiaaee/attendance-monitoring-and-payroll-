const express = require("express");
const router = express.Router();
const ClassSection = require("../models/ClassSection");
const Session = require("../models/Session");
const AttendanceRecord = require("../models/AttendanceRecord");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/", protect, authorize("teacher", "admin"), async (req, res) => {
  try {
    const { name, schedule } = req.body;
    if (!name) return res.status(400).json({ message: "Class name is required" });

    const newClass = await ClassSection.create({
      name,
      schedule,
      teacher: req.user._id,
      students: [],
    });

    res.status(201).json(newClass);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/", protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "teacher") {
      query = { teacher: req.user._id };
    } else if (req.user.role === "student") {
      query = { students: req.user._id };
    }

    const classes = await ClassSection.find(query)
      .populate("teacher", "name email")
      .populate("students", "name email studentId");

    res.json(classes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id", protect, async (req, res) => {
  try {
    const classSection = await ClassSection.findById(req.params.id)
      .populate("teacher", "name email")
      .populate("students", "name email studentId");

    if (!classSection) return res.status(404).json({ message: "Class not found" });
    res.json(classSection);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET attendance-rate summary per enrolled student — powers low-attendance alerts
router.get("/:id/summary", protect, authorize("teacher", "admin"), async (req, res) => {
  try {
    const classSection = await ClassSection.findById(req.params.id).populate(
      "students",
      "name email studentId"
    );
    if (!classSection) return res.status(404).json({ message: "Class not found" });

    const sessions = await Session.find({ classSection: req.params.id });
    const sessionIds = sessions.map((s) => s._id);
    const totalSessions = sessions.length;

    const records = await AttendanceRecord.find({ session: { $in: sessionIds } });

    const summary = classSection.students.map((student) => {
      const studentRecords = records.filter(
        (r) => r.student.toString() === student._id.toString()
      );
      const present = studentRecords.filter((r) => r.status === "present").length;
      const late = studentRecords.filter((r) => r.status === "late").length;
      const absent = studentRecords.filter((r) => r.status === "absent").length;
      const excused = studentRecords.filter((r) => r.status === "excused").length;
      const countedPresent = present + late + excused;
      const rate = totalSessions > 0 ? Math.round((countedPresent / totalSessions) * 100) : null;

      return {
        student: { _id: student._id, name: student.name, email: student.email },
        totalSessions,
        present,
        late,
        absent,
        excused,
        rate,
      };
    });

    res.json({ className: classSection.name, totalSessions, summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/enroll", protect, authorize("teacher", "admin"), async (req, res) => {
  try {
    const { studentId } = req.body;
    const classSection = await ClassSection.findById(req.params.id);
    if (!classSection) return res.status(404).json({ message: "Class not found" });

    if (classSection.students.includes(studentId)) {
      return res.status(400).json({ message: "Student is already enrolled" });
    }

    classSection.students.push(studentId);
    await classSection.save();

    res.json(classSection);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:id", protect, authorize("teacher", "admin"), async (req, res) => {
  try {
    const classSection = await ClassSection.findById(req.params.id);
    if (!classSection) return res.status(404).json({ message: "Class not found" });

    const isOwner = classSection.teacher.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ message: "You don't own this class" });
    }

    const { name, schedule } = req.body;
    if (name) classSection.name = name;
    if (schedule !== undefined) classSection.schedule = schedule;
    await classSection.save();

    res.json(classSection);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const deleted = await ClassSection.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Class not found" });
    res.json({ message: "Class deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
