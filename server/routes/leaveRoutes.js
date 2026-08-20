const express = require("express");
const router = express.Router();
const LeaveRequest = require("../models/LeaveRequest");
const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/", protect, authorize("student"), async (req, res) => {
  try {
    const { classSection, reason, dateFrom, dateTo } = req.body;
    if (!classSection || !reason || !dateFrom || !dateTo) {
      return res
        .status(400)
        .json({ message: "classSection, reason, dateFrom, and dateTo are required" });
    }

    const leaveRequest = await LeaveRequest.create({
      student: req.user._id,
      classSection,
      reason,
      dateFrom,
      dateTo,
      status: "pending",
    });

    res.status(201).json(leaveRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/", protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "student") {
      query.student = req.user._id;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }

    const requests = await LeaveRequest.find(query)
      .populate("student", "name email studentId")
      .populate("classSection", "name")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:id/review", protect, authorize("teacher", "admin"), async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "status must be 'approved' or 'rejected'" });
    }

    const leaveRequest = await LeaveRequest.findById(req.params.id);
    if (!leaveRequest) return res.status(404).json({ message: "Leave request not found" });

    leaveRequest.status = status;
    leaveRequest.reviewedBy = req.user._id;
    await leaveRequest.save();

    res.json(leaveRequest);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
