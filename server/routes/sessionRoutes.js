const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const router = express.Router();
const Session = require("../models/Session");
const Department = require("../models/Department");
const { protect, authorize } = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { todayKey, isValidDayKey, defaultMomentFor } = require("../utils/dayKey");
const { findDaySession } = require("../utils/daySessions");

const QR_VALID_MINUTES = 10;

const daySessionSchema = z.object({
  departmentId: z.string().min(1, "departmentId is required"),
  date: z.string().refine(isValidDayKey, "date must be a real day like 2026-10-12"),
});

const createSessionSchema = z.object({
  departmentId: z.string().min(1, "departmentId is required"),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

// Checks the manager owns the session's department (HR can access any)
function assertManagesDepartment(department, user) {
  const isOwner = department.manager?.toString() === user._id.toString();
  if (!isOwner && user.role !== "hr") {
    const err = new Error("You don't manage this department");
    err.statusCode = 403;
    throw err;
  }
}

router.post(
  "/",
  protect,
  authorize("manager", "hr"),
  validate(createSessionSchema),
  asyncHandler(async (req, res) => {
    const { departmentId, lat, lng } = req.body;

    const department = await Department.findById(departmentId);
    if (!department) return res.status(404).json({ message: "Department not found" });

    assertManagesDepartment(department, req.user);

    const qrToken = crypto.randomBytes(16).toString("hex");
    const qrExpiresAt = new Date(Date.now() + QR_VALID_MINUTES * 60 * 1000);
    const hasLocation = typeof lat === "number" && typeof lng === "number";
    const key = todayKey();

    // If today's session already exists, just give it a new QR code
    const existing = await findDaySession(departmentId, key);
    if (existing) {
      existing.qrToken = qrToken;
      existing.qrExpiresAt = qrExpiresAt;
      existing.dayKey = existing.dayKey || key;
      if (hasLocation) existing.location = { lat, lng };
      await existing.save();
      return res.status(200).json(existing);
    }

    const session = await Session.create({
      department: departmentId,
      date: new Date(),
      dayKey: key,
      qrToken,
      qrExpiresAt,
      location: hasLocation ? { lat, lng } : { lat: null, lng: null },
    });

    res.status(201).json(session);
  })
);

// The roster's date picker: which session (if any) a department has on a day.
router.get(
  "/department/:departmentId/day/:dayKey",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const { departmentId, dayKey } = req.params;
    if (!isValidDayKey(dayKey)) {
      return res.status(400).json({ message: "That's not a valid date" });
    }
    const department = await Department.findById(departmentId);
    if (!department) return res.status(404).json({ message: "Department not found" });
    assertManagesDepartment(department, req.user);

    const session = await findDaySession(departmentId, dayKey);
    res.json({ session: session || null });
  })
);

// Get or create the day's session without changing its QR code
router.post(
  "/day",
  protect,
  authorize("manager", "hr"),
  validate(daySessionSchema),
  asyncHandler(async (req, res) => {
    const { departmentId, date } = req.body;

    const department = await Department.findById(departmentId);
    if (!department) return res.status(404).json({ message: "Department not found" });
    assertManagesDepartment(department, req.user);

    if (date > todayKey()) {
      return res.status(400).json({ message: "You can't take attendance for a future date" });
    }

    const existing = await findDaySession(departmentId, date);
    if (existing) {
      if (!existing.dayKey) {
        existing.dayKey = date;
        await existing.save();
      }
      return res.json(existing);
    }

    const session = await Session.create({
      department: departmentId,
      date: defaultMomentFor(date, department),
      dayKey: date,
      // No live QR: start or regenerate it from the Sessions page
      qrToken: crypto.randomBytes(16).toString("hex"),
      qrExpiresAt: new Date(),
    });
    res.status(201).json(session);
  })
);

router.post(
  "/:id/regenerate-qr",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    const department = await Department.findById(session.department);
    if (!department) return res.status(404).json({ message: "Department not found" });
    assertManagesDepartment(department, req.user);

    session.qrToken = crypto.randomBytes(16).toString("hex");
    session.qrExpiresAt = new Date(Date.now() + QR_VALID_MINUTES * 60 * 1000);
    await session.save();

    res.json(session);
  })
);

router.get(
  "/department/:departmentId",
  protect,
  asyncHandler(async (req, res) => {
    const sessions = await Session.find({
      department: req.params.departmentId,
      isActive: { $ne: false },
    }).sort({
      date: -1,
    });
    res.json(sessions);
  })
);

router.get(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const session = await Session.findById(req.params.id).populate("department", "name");
    if (!session) return res.status(404).json({ message: "Session not found" });
    res.json(session);
  })
);

module.exports = router;
