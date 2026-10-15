const express = require("express");
const { z } = require("zod");
const router = express.Router();
const PayrollPayment = require("../models/PayrollPayment");
const Department = require("../models/Department");
const { protect, authorize } = require("../middleware/authMiddleware");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");

const ACTIVE_PAYMENT = { isActive: { $ne: false } };

const createPaymentSchema = z.object({
  staff: z.string().min(1, "staff is required"),
  department: z.string().min(1, "department is required"),
  amount: z.number().positive("amount must be greater than 0"),
  periodFrom: z.string().min(1, "periodFrom is required"),
  periodTo: z.string().min(1, "periodTo is required"),
  note: z.string().trim().max(500).optional(),
});

const updatePaymentSchema = z.object({
  amount: z.number().positive("amount must be greater than 0").optional(),
  periodFrom: z.string().optional(),
  periodTo: z.string().optional(),
  note: z.string().trim().max(500).optional(),
});

// Checks the manager owns the department and the staff member belongs to it (HR can access any)
async function assertCanRecordPayment(departmentId, staffId, user) {
  const department = await Department.findById(departmentId);
  if (!department) {
    const err = new Error("Department not found");
    err.statusCode = 404;
    throw err;
  }

  const isOwner = department.manager?.toString() === user._id.toString();
  if (!isOwner && user.role !== "hr") {
    const err = new Error("You don't manage this department");
    err.statusCode = 403;
    throw err;
  }

  const validRecipientIds = [
    department.manager?.toString(),
    ...department.staff.map((id) => id.toString()),
  ].filter(Boolean);
  if (!validRecipientIds.includes(staffId)) {
    const err = new Error("That person isn't part of this department");
    err.statusCode = 400;
    throw err;
  }

  return department;
}

router.post(
  "/",
  protect,
  authorize("manager", "hr"),
  validate(createPaymentSchema),
  asyncHandler(async (req, res) => {
    const { staff, department, amount, periodFrom, periodTo, note } = req.body;

    await assertCanRecordPayment(department, staff, req.user);

    const periodFromDate = new Date(periodFrom);
    const periodToDate = new Date(periodTo);
    if (isNaN(periodFromDate) || isNaN(periodToDate)) {
      return res.status(400).json({ message: "periodFrom/periodTo must be valid dates" });
    }
    if (periodToDate < periodFromDate) {
      return res.status(400).json({ message: "periodTo can't be before periodFrom" });
    }

    const payment = await PayrollPayment.create({
      staff,
      department,
      amount,
      periodFrom: periodFromDate,
      periodTo: periodToDate,
      note: note || "",
      paidBy: req.user._id,
    });

    const populated = await payment.populate("staff", "name email staffId");
    res.status(201).json(populated);
  })
);

// List payments with totals, filtered by paidAt date range
router.get(
  "/department/:departmentId",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const department = await Department.findById(req.params.departmentId).populate(
      "manager",
      "name email"
    );
    if (!department) return res.status(404).json({ message: "Department not found" });

    // manager is null if the user was removed
    const isOwner = !!department.manager && department.manager._id.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "hr") {
      return res.status(403).json({ message: "You don't manage this department" });
    }

    const query = { department: req.params.departmentId, ...ACTIVE_PAYMENT };
    const { from, to } = req.query;
    if (from || to) {
      query.paidAt = {};
      if (from) query.paidAt.$gte = new Date(`${from}T00:00:00`);
      if (to) query.paidAt.$lte = new Date(`${to}T23:59:59.999`);
    }

    const found = await PayrollPayment.find(query)
      .populate("staff", "name email staffId")
      .populate("paidBy", "name")
      .sort({ paidAt: -1 });

    // staff is null if the user was removed; show a placeholder
    const DELETED_STAFF = { _id: "deleted-user", name: "Deleted user", email: "", staffId: null };
    const payments = found.map((doc) => {
      const p = doc.toObject();
      if (!p.staff) p.staff = DELETED_STAFF;
      return p;
    });

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const staffPaidIds = new Set(payments.map((p) => p.staff._id.toString()));

    const byStaffMap = new Map();
    payments.forEach((p) => {
      const key = p.staff._id.toString();
      if (!byStaffMap.has(key)) {
        byStaffMap.set(key, {
          staff: { _id: p.staff._id, name: p.staff.name, email: p.staff.email, staffId: p.staff.staffId },
          totalPaid: 0,
          paymentCount: 0,
          lastPaidAt: p.paidAt,
        });
      }
      const entry = byStaffMap.get(key);
      entry.totalPaid += p.amount;
      entry.paymentCount += 1;
      if (p.paidAt > entry.lastPaidAt) entry.lastPaidAt = p.paidAt;
    });

    const byStaff = Array.from(byStaffMap.values()).sort((a, b) => b.totalPaid - a.totalPaid);

    res.json({
      departmentName: department.name,
      totalPaid: Math.round(totalPaid * 100) / 100,
      paymentCount: payments.length,
      staffPaidCount: staffPaidIds.size,
      byStaff,
      payments,
    });
  })
);

router.put(
  "/:id",
  protect,
  authorize("manager", "hr"),
  validate(updatePaymentSchema),
  asyncHandler(async (req, res) => {
    const payment = await PayrollPayment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    await assertCanRecordPayment(payment.department, payment.staff.toString(), req.user);

    const { amount, periodFrom, periodTo, note } = req.body;
    if (amount !== undefined) payment.amount = amount;
    if (periodFrom !== undefined) payment.periodFrom = new Date(periodFrom);
    if (periodTo !== undefined) payment.periodTo = new Date(periodTo);
    if (note !== undefined) payment.note = note;

    if (payment.periodTo < payment.periodFrom) {
      return res.status(400).json({ message: "periodTo can't be before periodFrom" });
    }

    await payment.save();
    const populated = await payment.populate("staff", "name email staffId");
    res.json(populated);
  })
);

// Soft delete
router.delete(
  "/:id",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const payment = await PayrollPayment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    await assertCanRecordPayment(payment.department, payment.staff.toString(), req.user);

    payment.isActive = false;
    await payment.save();

    res.json({ message: "Payment removed" });
  })
);

module.exports = router;
