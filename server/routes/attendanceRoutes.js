const express = require("express");
const { z } = require("zod");
const router = express.Router();

// Absent and excused records have no check-in, check-out or hours
const { defaultMomentFor } = require("../utils/dayKey");

const NO_SHOW = ["absent", "excused"];
const isNoShow = (status) => NO_SHOW.includes(status);

const AttendanceRecord = require("../models/AttendanceRecord");
const Session = require("../models/Session");
const Department = require("../models/Department");
const { protect, authorize } = require("../middleware/authMiddleware");
const { distanceMeters } = require("../utils/geo");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { checkinLimiter } = require("../middleware/rateLimiters");

// Check-ins farther than this from the session are flagged for review, not blocked
const CHECKIN_RADIUS_METERS = 150;

const checkinSchema = z.object({
  qrToken: z.string().min(1, "qrToken is required"),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

const manualSchema = z.object({
  sessionId: z.string().min(1),
  staffId: z.string().min(1),
  status: z.enum(["present", "late", "absent", "excused"]),
});

// Excludes soft-deleted records
const ACTIVE_RECORD = { isActive: { $ne: false } };

// Checks the manager owns the session's department (HR can access any)
async function assertManagesSession(sessionId, user) {
  const session = await Session.findById(sessionId);
  if (!session) {
    const err = new Error("Session not found");
    err.statusCode = 404;
    throw err;
  }
  if (user.role !== "hr") {
    const department = await Department.findById(session.department);
    const isOwner = department?.manager?.toString() === user._id.toString();
    if (!isOwner) {
      const err = new Error("You don't manage this department");
      err.statusCode = 403;
      throw err;
    }
  }
  return session;
}

// STAFF CHECK-IN via QR scan
router.post(
  "/checkin",
  protect,
  authorize("staff"),
  checkinLimiter,
  validate(checkinSchema),
  asyncHandler(async (req, res) => {
    const { qrToken, lat, lng } = req.body;

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

    // Compare the device location with the session location
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

    // Marked absent/excused but scanned in: counts as a check-in
    if (existing && isNoShow(existing.status)) {
      existing.status = "present";
      existing.timestamp = new Date();
      existing.checkOutTime = null;
      existing.hoursWorked = null;
      existing.location = location;
      existing.distanceMeters = distance;
      existing.flagged = flagged;
      existing.flagReason = flagReason;
      await existing.save();

      return res.json({ ...existing.toObject(), type: "checkin" });
    }

    // A second scan is a check-out
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
  })
);

// MANAGER/HR manual override — mark a staff member's status directly
router.post(
  "/manual",
  protect,
  authorize("manager", "hr"),
  validate(manualSchema),
  asyncHandler(async (req, res) => {
    const { sessionId, staffId, status } = req.body;

    const session = await assertManagesSession(sessionId, req.user);

    // Timestamp for a new check-in
    const department = session.dayKey ? await Department.findById(session.department) : null;
    const checkInMoment = session.dayKey ? defaultMomentFor(session.dayKey, department) : new Date();

    // Only set the check-in time when the record is first created
    const existing = await AttendanceRecord.findOne({ session: sessionId, staff: staffId });
    const wasNoShow = existing && isNoShow(existing.status);

    const update = { $set: { status } };
    if (isNoShow(status)) {
      // Absent / excused: no times, no hours.
      update.$set.checkOutTime = null;
      update.$set.hoursWorked = null;
    } else if (wasNoShow) {
      // Absent/excused to present/late: start a fresh check-in
      update.$set.timestamp = checkInMoment;
      update.$set.checkOutTime = null;
      update.$set.hoursWorked = null;
    }
    // New record: stamp it
    if (!existing) update.$setOnInsert = { timestamp: checkInMoment };

    const record = await AttendanceRecord.findOneAndUpdate(
      { session: sessionId, staff: staffId },
      update,
      { upsert: true, new: true, runValidators: true }
    );

    res.json(record);
  })
);

// MANAGER/HR manually sets (or corrects) a check-out time
router.put(
  "/:id/checkout",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const record = await AttendanceRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    await assertManagesSession(record.session, req.user);

    if (isNoShow(record.status)) {
      return res.status(400).json({
        message: "Absent or excused staff have no check-in/check-out times. Mark them present or late first.",
      });
    }

    const checkOutTime = req.body.checkOutTime ? new Date(req.body.checkOutTime) : new Date();
    if (isNaN(checkOutTime.getTime())) {
      return res.status(400).json({ message: "That's not a valid check-out time" });
    }
    if (checkOutTime < record.timestamp) {
      return res.status(400).json({ message: "Check-out time can't be before check-in time" });
    }

    record.checkOutTime = checkOutTime;
    record.hoursWorked = Math.round(((checkOutTime - record.timestamp) / 3600000) * 100) / 100;
    await record.save();

    res.json(record);
  })
);

// MANAGER/HR corrects check-in and/or check-out times (ISO strings; checkOutTime can be null)
const timesSchema = z
  .object({
    checkInTime: z.string().min(1).optional(),
    checkOutTime: z.string().min(1).nullable().optional(),
  })
  .refine((b) => b.checkInTime !== undefined || b.checkOutTime !== undefined, {
    message: "Provide a check-in and/or check-out time",
  });

router.put(
  "/:id/times",
  protect,
  authorize("manager", "hr"),
  validate(timesSchema),
  asyncHandler(async (req, res) => {
    const record = await AttendanceRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    await assertManagesSession(record.session, req.user);

    if (isNoShow(record.status)) {
      return res.status(400).json({
        message: "Absent or excused staff have no check-in/check-out times. Mark them present or late first.",
      });
    }

    const { checkInTime, checkOutTime } = req.body;

    let newIn = record.timestamp;
    if (checkInTime !== undefined) {
      newIn = new Date(checkInTime);
      if (isNaN(newIn.getTime())) {
        return res.status(400).json({ message: "That's not a valid check-in time" });
      }
    }

    let newOut = record.checkOutTime;
    if (checkOutTime !== undefined) {
      if (checkOutTime === null) {
        newOut = null;
      } else {
        newOut = new Date(checkOutTime);
        if (isNaN(newOut.getTime())) {
          return res.status(400).json({ message: "That's not a valid check-out time" });
        }
      }
    }

    if (newOut && newOut < newIn) {
      return res.status(400).json({ message: "Check-out time can't be before check-in time" });
    }

    record.timestamp = newIn;
    record.checkOutTime = newOut;
    record.hoursWorked = newOut ? Math.round(((newOut - newIn) / 3600000) * 100) / 100 : null;
    await record.save();

    res.json(record);
  })
);

// MANAGER/HR removes a record (soft delete)
router.delete(
  "/:id",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const record = await AttendanceRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    await assertManagesSession(record.session, req.user);

    record.isActive = false;
    await record.save();

    res.json({ message: "Attendance record removed" });
  })
);

// GET attendance records for a specific session (manager's roster view)
router.get(
  "/session/:sessionId",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    await assertManagesSession(req.params.sessionId, req.user);

    const records = await AttendanceRecord.find({
      session: req.params.sessionId,
      ...ACTIVE_RECORD,
    }).populate("staff", "name email staffId");
    res.json(records);
  })
);

// GET a staff member's own attendance history
router.get(
  "/staff/:staffId",
  protect,
  asyncHandler(async (req, res) => {
    if (req.user.role === "staff" && req.user._id.toString() !== req.params.staffId) {
      return res.status(403).json({ message: "You can only view your own attendance" });
    }

    const records = await AttendanceRecord.find({ staff: req.params.staffId, ...ACTIVE_RECORD })
      .populate({ path: "session", populate: { path: "department", select: "name" } })
      .sort({ timestamp: -1 });

    res.json(records);
  })
);

module.exports = router;
