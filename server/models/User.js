const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: [true, "Password is required"], minlength: 6 },
    role: { type: String, enum: ["hr", "manager", "staff"], default: "staff" },
    staffId: { type: String, default: null },
    // Managers who self-register start as unapproved and cannot log in until
    // an HR admin approves them. Staff and HR-created accounts skip this.
    approved: { type: Boolean, default: true },
    // Soft-delete flag. HR "deleting" a user now just flips this to false —
    // the document (and every historical reference to it: department staff
    // arrays, sessions, attendance records, leave requests) stays intact.
    // Deactivated users can't log in and are excluded from active-staff
    // pickers, but their name/history keeps showing up everywhere else.
    isActive: { type: Boolean, default: true },
    // Bumped whenever the password is reset (see authRoutes.js). A JWT
    // embeds the tokenVersion it was issued with; protect() rejects any
    // token whose version doesn't match the current one, so a reset
    // immediately invalidates every token issued before it — otherwise an
    // old token would keep working for up to its full 7-day lifetime even
    // after the password (and presumably the reason for resetting it) changes.
    tokenVersion: { type: Number, default: 0 },
    // Profile picture, stored as a small (~256px) JPEG data URL — the browser
    // crops/resizes it before upload, so it's only a few tens of KB. null =
    // no picture (the UI falls back to the user's initials).
    avatar: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
