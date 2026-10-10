const express = require("express");
const router = express.Router();
const StaffNote = require("../models/StaffNote");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");

// GET all notes for a staff member — manager/HR only
router.get(
  "/staff/:staffId",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const notes = await StaffNote.find({ staff: req.params.staffId })
      .populate("author", "name role")
      .sort({ createdAt: -1 });
    res.json(notes);
  })
);

// POST a new note about a staff member — manager/HR only
router.post(
  "/staff/:staffId",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Note text is required" });
    }

    const staffUser = await User.findById(req.params.staffId);
    if (!staffUser || staffUser.role !== "staff") {
      return res.status(404).json({ message: "Staff member not found" });
    }

    const note = await StaffNote.create({
      staff: req.params.staffId,
      author: req.user._id,
      text: text.trim(),
    });

    const populated = await note.populate("author", "name role");
    res.status(201).json(populated);
  })
);

// DELETE a note — only its author or an HR admin can remove it
router.delete(
  "/:id",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const note = await StaffNote.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const isAuthor = note.author.toString() === req.user._id.toString();
    if (!isAuthor && req.user.role !== "hr") {
      return res.status(403).json({ message: "You can only delete your own notes" });
    }

    await StaffNote.findByIdAndDelete(req.params.id);
    res.json({ message: "Note removed" });
  })
);

module.exports = router;
