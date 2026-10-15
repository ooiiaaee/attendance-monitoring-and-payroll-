const express = require("express");
const router = express.Router();
const LeaveRequest = require("../models/LeaveRequest");
const Department = require("../models/Department");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendEmail } = require("../utils/mailer");
const asyncHandler = require("../utils/asyncHandler");

router.post(
  "/",
  protect,
  authorize("staff"),
  asyncHandler(async (req, res) => {
    const { department, reason, dateFrom, dateTo } = req.body;
    if (!department || !reason || !dateFrom || !dateTo) {
      return res
        .status(400)
        .json({ message: "department, reason, dateFrom, and dateTo are required" });
    }

    const leaveRequest = await LeaveRequest.create({
      staff: req.user._id,
      department,
      reason,
      dateFrom,
      dateTo,
      status: "pending",
    });

    // Notify the department's manager
    const dept = await Department.findById(department).populate("manager", "name email");
    if (dept?.manager?.email) {
      sendEmail({
        to: dept.manager.email,
        subject: `New leave request from ${req.user.name}`,
        text: `Hi ${dept.manager.name},\n\n${req.user.name} has submitted a leave request for ${dept.name}:\n\nReason: ${reason}\nFrom: ${new Date(dateFrom).toDateString()}\nTo: ${new Date(dateTo).toDateString()}\n\nReview it in the app when you get a chance.`,
      });
    }

    res.status(201).json(leaveRequest);
  })
);

router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    let query = {};
    if (req.user.role === "staff") {
      query.staff = req.user._id;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }

    const requests = await LeaveRequest.find(query)
      .populate("staff", "name email staffId")
      .populate("department", "name")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 });

    res.json(requests);
  })
);

router.put(
  "/:id/review",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const { status, note } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "status must be 'approved' or 'rejected'" });
    }
    if (note !== undefined && typeof note !== "string") {
      return res.status(400).json({ message: "note must be text" });
    }
    const reviewNote = status === "rejected" ? (note || "").trim() : "";
    if (reviewNote.length > 500) {
      return res.status(400).json({ message: "Note can be at most 500 characters" });
    }

    const leaveRequest = await LeaveRequest.findById(req.params.id).populate(
      "staff",
      "name email"
    );
    if (!leaveRequest) return res.status(404).json({ message: "Leave request not found" });

    leaveRequest.status = status;
    leaveRequest.reviewedBy = req.user._id;
    leaveRequest.reviewNote = reviewNote; // only kept for rejections
    await leaveRequest.save();

    if (leaveRequest.staff?.email) {
      sendEmail({
        to: leaveRequest.staff.email,
        subject: `Your leave request was ${status}`,
        text: `Hi ${leaveRequest.staff.name},\n\nYour leave request (${new Date(leaveRequest.dateFrom).toDateString()} – ${new Date(leaveRequest.dateTo).toDateString()}) has been ${status} by ${req.user.name}.${reviewNote ? `\n\nNote from ${req.user.name}: ${reviewNote}` : ""}`,
      });
    }

    res.json(leaveRequest);
  })
);

module.exports = router;
