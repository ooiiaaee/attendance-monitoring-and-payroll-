const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Department = require("../models/Department");
const generateToken = require("../utils/generateToken");
const { protect, authorize } = require("../middleware/authMiddleware");
const { sendEmail } = require("../utils/mailer");
const { logAudit } = require("../utils/auditLog");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { loginLimiter } = require("../middleware/rateLimiters");
const { generateStaffId } = require("../utils/generateStaffId");

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Must be a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["manager", "staff"]).optional(),
  staffId: z.string().trim().optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().trim().email("Must be a valid email"),
  password: z.string().min(1, "Password is required"),
});

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Must be a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["hr", "manager", "staff"]),
  staffId: z.string().trim().optional().nullable(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

const avatarSchema = z.object({
  avatar: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Avatar must be a JPEG, PNG or WebP image")
    .max(200000, "Image is too large — please choose a smaller one"),
});

const updateMeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Must be a valid email"),
});

// Public register: staff can log in right away, managers need HR approval
router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    // staffId from the client is ignored; the server assigns it
    const { name, email, password, role } = req.body;

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
      staffId: isManager ? null : await generateStaffId(),
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

      // No token until an HR admin approves the account
      return res.status(201).json({
        pendingApproval: true,
        message:
          "Your manager account has been created and is pending HR admin approval. You'll be able to log in once approved.",
      });
    }

    const token = generateToken(user._id, user.role, user.tokenVersion);
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      staffId: user.staffId,
      avatar: user.avatar,
      token,
    });
  })
);

router.post(
  "/login",
  loginLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

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

    if (!user.isActive) {
      return res.status(403).json({
        message: "This account has been deactivated. Contact your HR admin.",
      });
    }

    const token = generateToken(user._id, user.role, user.tokenVersion);
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      staffId: user.staffId,
      avatar: user.avatar,
      token,
    });
  })
);

router.get(
  "/me",
  protect,
  asyncHandler(async (req, res) => {
    res.json(req.user);
  })
);

// Verify the current login
router.get(
  "/verify",
  protect,
  asyncHandler(async (req, res) => {
    const token = req.headers.authorization.split(" ")[1];
    const claims = jwt.decode(token) || {};
    res.json({
      valid: true,
      message: "Token and account verified",
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        staffId: req.user.staffId || null,
        approved: req.user.approved,
        isActive: req.user.isActive,
      },
      token: {
        issuedAt: claims.iat ? new Date(claims.iat * 1000) : null,
        expiresAt: claims.exp ? new Date(claims.exp * 1000) : null,
      },
    });
  })
);

// UPDATE own name/email — any logged-in user.
router.put(
  "/me",
  protect,
  validate(updateMeSchema),
  asyncHandler(async (req, res) => {
    const { name, email } = req.body;

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
  })
);

// Set own avatar (client sends a resized data URL)
router.put(
  "/me/avatar",
  protect,
  validate(avatarSchema),
  asyncHandler(async (req, res) => {
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: req.body.avatar },
      { new: true }
    ).select("-password");
    res.json(updated);
  })
);

// Remove own avatar
router.delete(
  "/me/avatar",
  protect,
  asyncHandler(async (req, res) => {
    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: null },
      { new: true }
    ).select("-password");
    res.json(updated);
  })
);

// Change own password; signs out other devices and returns a new token
router.put(
  "/me/password",
  protect,
  loginLimiter, // limit password guessing
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // req.user has no password hash, so fetch it
    const user = await User.findById(req.user._id);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (await bcrypt.compare(newPassword, user.password)) {
      return res
        .status(400)
        .json({ message: "New password must be different from your current one" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.tokenVersion += 1;
    await user.save();

    await logAudit(user._id, "user.change_password", "User", user._id, `Changed own password: ${user.email}`);

    const token = generateToken(user._id, user.role, user.tokenVersion);
    res.json({ message: "Password updated", token });
  })
);

router.get(
  "/staff",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    // isActive: { $ne: false } also matches users without the field
    const staffMembers = await User.find({ role: "staff", isActive: { $ne: false } }).select(
      "name email staffId"
    );

    // Mark staff who are already in a department
    const activeDepartments = await Department.find({ isActive: { $ne: false } }).select(
      "name staff"
    );
    const departmentOf = new Map();
    activeDepartments.forEach((d) =>
      d.staff.forEach((id) => departmentOf.set(id.toString(), { _id: d._id, name: d.name }))
    );

    res.json(
      staffMembers.map((s) => ({
        ...s.toObject(),
        department: departmentOf.get(s._id.toString()) || null,
      }))
    );
  })
);

router.get(
  "/users",
  protect,
  authorize("hr"),
  asyncHandler(async (req, res) => {
    const users = await User.find()
      .select("name email role staffId approved isActive createdAt")
      .sort({ createdAt: -1 });
    res.json(users);
  })
);

// HR-created accounts are always approved
router.post(
  "/users",
  protect,
  authorize("hr"),
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password, role, staffId } = req.body;

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
      // HR can supply a custom ID, otherwise one is generated
      staffId: role === "staff" ? staffId || (await generateStaffId()) : null,
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
  })
);

// HR admin approves a pending manager account
router.put(
  "/users/:id/approve",
  protect,
  authorize("hr"),
  asyncHandler(async (req, res) => {
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
  })
);

// Decline a pending manager; the account is removed
router.delete(
  "/users/:id/decline",
  protect,
  authorize("hr"),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role !== "manager" || user.approved) {
      return res
        .status(400)
        .json({ message: "Only pending manager accounts can be declined" });
    }

    await User.deleteOne({ _id: user._id });

    sendEmail({
      to: user.email,
      subject: "Your manager account request was declined",
      text: `Hi ${user.name},\n\nYour request for a manager account was not approved by HR. If you think this was a mistake, please contact your HR admin.`,
    });

    await logAudit(req.user._id, "user.decline", "User", user._id, `Declined manager account: ${user.email}`);

    res.json({ message: "Manager account declined" });
  })
);

// HR resets a user's password
router.put(
  "/users/:id/reset-password",
  protect,
  authorize("hr"),
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { newPassword } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    // Invalidate tokens issued before the reset
    user.tokenVersion += 1;
    await user.save();

    sendEmail({
      to: user.email,
      subject: "Your password was reset by an HR admin",
      text: `Hi ${user.name},\n\nAn HR admin just reset your password. If you weren't expecting this, contact HR right away.`,
    });

    await logAudit(req.user._id, "user.reset_password", "User", user._id, `Reset password for: ${user.email}`);

    res.json({ message: `Password reset for ${user.email}` });
  })
);

// Soft delete: sets isActive to false and keeps history
router.delete(
  "/users/:id",
  protect,
  authorize("hr"),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "You can't deactivate your own account" });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });

    // HR admin accounts can't be deactivated from the panel
    if (target.role === "hr") {
      return res.status(403).json({ message: "HR admin accounts cannot be deactivated" });
    }

    if (!target.isActive) {
      return res.status(400).json({ message: "This user is already deactivated" });
    }

    target.isActive = false;
    await target.save();

    await logAudit(
      req.user._id,
      "user.deactivate",
      "User",
      target._id,
      `Deactivated ${target.role} account: ${target.email}`
    );

    res.json({ message: "User deactivated successfully" });
  })
);

// Reactivate an account
router.put(
  "/users/:id/reactivate",
  protect,
  authorize("hr"),
  asyncHandler(async (req, res) => {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found" });

    if (target.isActive) {
      return res.status(400).json({ message: "This user is already active" });
    }

    target.isActive = true;
    await target.save();

    await logAudit(
      req.user._id,
      "user.reactivate",
      "User",
      target._id,
      `Reactivated ${target.role} account: ${target.email}`
    );

    res.json({ message: "User reactivated successfully" });
  })
);

module.exports = router;
