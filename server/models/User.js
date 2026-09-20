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
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
