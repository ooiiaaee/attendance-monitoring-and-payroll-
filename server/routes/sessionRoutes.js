const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const router = express.Router();
const Session = require("../models/Session");
const Department = require("../models/Department");
const { protect, authorize } = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");

const QR_VALID_MINUTES = 10;

const createSessionSchema = z.object({
  departmentId: z.string().min(1, "departmentId is required"),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

// Shared by both POST / and POST /:id/regenerate-qr — confirms the
// requesting manager actually owns the department a session belongs to
// (HR can act on any department).
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

    const session = await Session.create({
      department: departmentId,
      date: new Date(),
      qrToken,
      qrExpiresAt,
      location:
        typeof lat === "number" && typeof lng === "number" ? { lat, lng } : { lat: null, lng: null },
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

    // This check was previously missing entirely — any manager could
    // regenerate (and thereby invalidate) any other manager's live QR code
    // for a session they had no part in.
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
    const sessions = await Session.find({ department: req.params.departmentId }).sort({
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
