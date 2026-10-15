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
    // Managers must be approved by an HR admin before they can log in
    approved: { type: Boolean, default: true },
    // Soft delete flag
    isActive: { type: Boolean, default: true },
    // Increased on password reset to invalidate old tokens
    tokenVersion: { type: Number, default: 0 },
    // Profile picture as a data URL; null means no picture
    avatar: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
