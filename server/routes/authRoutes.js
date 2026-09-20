const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendEmail } = require("../utils/mailer");
const { logAudit } = require("../utils/auditLog");

// PUBLIC REGISTER — staff log in immediately. Managers are created as
// unapproved and cannot log in until an HR admin approves them.
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, staffId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    if (role === "hr") {
      return res.status(403).json({ message: "HR admin accounts cannot be self-registered" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const isManager = role === "manager";

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "staff",
      staffId: staffId || null,
      approved: !isManager, // managers start unapproved; staff are approved immediately
    });

    if (isManager) {
      const hrAdmins = await User.find({ role: "hr" }).select("email");
      hrAdmins.forEach((hr) => {
        sendEmail({
          to: hr.email,
          subject: "A new manager account is awaiting approval",
          text: `${name} (${email}) just registered as a manager and is waiting for approval before they can log in.`,
        });
      });

      // No token issued — they can't use the app until an HR admin approves them.
      return res.status(201).json({
        pendingApproval: true,
        message:
          "Your manager account has been created and is pending HR admin approval. You'll be able to log in once approved.",
      });
    }

    const token = generateToken(user._id, user.role);
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.role === "manager" && !user.approved) {
      return res.status(403).json({
        message: "Your account is pending HR admin approval. Please check back later.",
      });
    }

    const token = generateToken(user._id, user.role);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/me", protect, async (req, res) => {
  res.json(req.user);
});

// UPDATE own name/email — any logged-in user. (Password self-change removed
// on purpose — password resets now go through an HR admin only.)
router.put("/me", protect, async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    if (email !== req.user.email) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ message: "That email is already in use" });
      }
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { name, email },
      { new: true, runValidators: true }
    ).select("-password");

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/staff", protect, authorize("manager", "hr"), async (req, res) => {
  try {
    const staffMembers = await User.find({ role: "staff" }).select("name email staffId");
    res.json(staffMembers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/users", protect, authorize("hr"), async (req, res) => {
  try {
    const users = await User.find()
      .select("name email role staffId approved createdAt")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// HR-created accounts are always pre-approved, whatever the role.
router.post("/users", protect, authorize("hr"), async (req, res) => {
  try {
    const { name, email, password, role, staffId } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password, and role are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      staffId: role === "staff" ? staffId || null : null,
      approved: true,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      staffId: user.staffId,
      approved: user.approved,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// HR admin approves a pending manager account
router.put("/users/:id/approve", protect, authorize("hr"), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { approved: true },
      { new: true }
    ).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    sendEmail({
      to: user.email,
      subject: "Your manager account has been approved",
      text: `Hi ${user.name},\n\nYour manager account has been approved by HR. You can now log in and start using the app.`,
    });

    await logAudit(req.user._id, "user.approve", "User", user._id, `Approved manager account: ${user.email}`);

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// HR admin resets any user's password directly — the only password-reset path
// in the app now. There is no self-service "change password" anymore.
router.put("/users/:id/reset-password", protect, authorize("hr"), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    sendEmail({
      to: user.email,
      subject: "Your password was reset by an HR admin",
      text: `Hi ${user.name},\n\nAn HR admin just reset your password. If you weren't expecting this, contact HR right away.`,
    });

    await logAudit(req.user._id, "user.reset_password", "User", user._id, `Reset password for: ${user.email}`);

    res.json({ message: `Password reset for ${user.email}` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/users/:id", protect, authorize("hr"), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "You can't delete your own account" });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });

    // HR admin accounts can never be deleted from the panel, even by another
    // HR admin. If an HR account genuinely needs to go, do it manually in
    // the database.
    if (target.role === "hr") {
      return res.status(403).json({ message: "HR admin accounts cannot be deleted" });
    }

    await User.findByIdAndDelete(req.params.id);

    await logAudit(
      req.user._id,
      "user.delete",
      "User",
      target._id,
      `Deleted ${target.role} account: ${target.email}`
    );

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
