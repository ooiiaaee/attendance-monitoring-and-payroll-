const express = require("express");
const router = express.Router();
const AttendanceRecord = require("../models/AttendanceRecord");
const Session = require("../models/Session");
const Department = require("../models/Department");
const { protect, authorize } = require("../middleware/authMiddleware");
const { distanceMeters } = require("../utils/geo");

// A check-in further than this from where the session was started gets
// flagged for the manager to review, rather than being blocked outright —
// GPS accuracy indoors is unreliable enough that a hard block would cause
// too many false rejections.
const CHECKIN_RADIUS_METERS = 150;

// STAFF CHECK-IN via QR scan
router.post("/checkin", protect, authorize("staff"), async (req, res) => {
  try {
    const { qrToken, lat, lng } = req.body;
    if (!qrToken) return res.status(400).json({ message: "qrToken is required" });

    const session = await Session.findOne({ qrToken });
    if (!session) return res.status(404).json({ message: "Invalid QR code" });

    if (session.qrExpiresAt < new Date()) {
      return res.status(400).json({ message: "This QR code has expired" });
    }

    const department = await Department.findById(session.department);
    const isEnrolled = department.staff.some(
      (staffId) => staffId.toString() === req.user._id.toString()
    );
    if (!isEnrolled) {
      return res.status(403).json({ message: "You are not assigned to this department" });
    }

    // Compare the staff device's location against where the manager started
    // the session, if both are available.
    const sessionHasLocation = session.location?.lat != null && session.location?.lng != null;
    const staffHasLocation = typeof lat === "number" && typeof lng === "number";

    let location = { lat: null, lng: null };
    let distance = null;
    let flagged = false;
    let flagReason = null;

    if (staffHasLocation) {
      location = { lat, lng };
      if (sessionHasLocation) {
        distance = Math.round(distanceMeters(session.location.lat, session.location.lng, lat, lng));
        if (distance > CHECKIN_RADIUS_METERS) {
          flagged = true;
          flagReason = `Checked in ${distance}m from where the session was started`;
        }
      }
    } else if (sessionHasLocation) {
      flagged = true;
      flagReason = "Location wasn't shared at check-in";
    }

    const existing = await AttendanceRecord.findOne({
      session: session._id,
      staff: req.user._id,
    });

    // A second scan of the same session's QR is treated as check-out.
    if (existing) {
      if (existing.checkOutTime) {
        return res.status(400).json({ message: "You've already checked out for this session" });
      }

      existing.checkOutTime = new Date();
      existing.hoursWorked =
        Math.round(((existing.checkOutTime - existing.timestamp) / 3600000) * 100) / 100;
      await existing.save();

      return res.json({ ...existing.toObject(), type: "checkout" });
    }

    const record = await AttendanceRecord.create({
      session: session._id,
      staff: req.user._id,
      status: "present",
      timestamp: new Date(),
      location,
      distanceMeters: distance,
      flagged,
      flagReason,
    });

    res.status(201).json({ ...record.toObject(), type: "checkin" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// MANAGER/HR manual override — mark a staff member's status directly
router.post("/manual", protect, authorize("manager", "hr"), async (req, res) => {
  try {
    const { sessionId, staffId, status } = req.body;
    if (!sessionId || !staffId || !status) {
      return res.status(400).json({ message: "sessionId, staffId, and status are required" });
    }

    const record = await AttendanceRecord.findOneAndUpdate(
      { session: sessionId, staff: staffId },
      { status, timestamp: new Date() },
      { upsert: true, new: true, runValidators: true }
    );

    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// MANAGER/HR manually sets (or corrects) a check-out time
router.put("/:id/checkout", protect, authorize("manager", "hr"), async (req, res) => {
  try {
    const record = await AttendanceRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    const checkOutTime = req.body.checkOutTime ? new Date(req.body.checkOutTime) : new Date();
    if (checkOutTime < record.timestamp) {
      return res.status(400).json({ message: "Check-out time can't be before check-in time" });
    }

    record.checkOutTime = checkOutTime;
    record.hoursWorked = Math.round(((checkOutTime - record.timestamp) / 3600000) * 100) / 100;
    await record.save();

    res.json(record);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// MANAGER/HR removes a record — useful for corrections or clearing a test check-in
router.delete("/:id", protect, authorize("manager", "hr"), async (req, res) => {
  try {
    const deleted = await AttendanceRecord.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Record not found" });
    res.json({ message: "Attendance record removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET attendance records for a specific session (manager's roster view)
router.get("/session/:sessionId", protect, async (req, res) => {
  try {
    const records = await AttendanceRecord.find({ session: req.params.sessionId }).populate(
      "staff",
      "name email staffId"
    );
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET a staff member's own attendance history
router.get("/staff/:staffId", protect, async (req, res) => {
  try {
    if (req.user.role === "staff" && req.user._id.toString() !== req.params.staffId) {
      return res.status(403).json({ message: "You can only view your own attendance" });
    }

    const records = await AttendanceRecord.find({ staff: req.params.staffId })
      .populate({ path: "session", populate: { path: "department", select: "name" } })
      .sort({ timestamp: -1 });

    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
