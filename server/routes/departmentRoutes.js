const express = require("express");
const { z } = require("zod");
const router = express.Router();

// Deactivated accounts are left out of department lists, counts and reports
const ACTIVE_STAFF = {
  path: "staff",
  select: "name email staffId",
  match: { isActive: { $ne: false } },
};

const Department = require("../models/Department");
const User = require("../models/User");
const Session = require("../models/Session");
const AttendanceRecord = require("../models/AttendanceRecord");
const { protect, authorize } = require("../middleware/authMiddleware");
const { logAudit } = require("../utils/auditLog");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");

const scheduleBlockSchema = z.object({
  day: z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "endTime must be HH:MM"),
});

const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, "Department name is required"),
  schedule: z.array(scheduleBlockSchema).optional(),
  // HR only: who will manage the new department (managers always manage their own)
  managerId: z.string().min(1).optional(),
});
const assignManagerSchema = z.object({
  managerId: z.string().min(1, "Choose a manager"),
});

const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1).optional(),
  schedule: z.array(scheduleBlockSchema).optional(),
});

const enrollSchema = z.object({
  staffId: z.string().min(1, "staffId is required"),
});

// Excludes soft-deleted records
const ACTIVE_RECORD = { isActive: { $ne: false } };

// Only an approved, active manager (or HR) can be put in charge
async function resolveManagerForAssignment(managerId, actingUser) {
  if (String(managerId) === String(actingUser._id)) return actingUser; // HR managing it themselves
  let manager = null;
  try {
    manager = await User.findById(managerId).select("name email role approved isActive");
  } catch (e) {
    manager = null; // not a valid id
  }
  const problem =
    !manager ? "That manager account doesn't exist"
    : manager.role !== "manager" ? `${manager.name} isn't a manager account`
    : manager.approved === false ? `${manager.name}'s manager account hasn't been approved yet`
    : manager.isActive === false ? `${manager.name}'s account is deactivated`
    : null;
  if (problem) {
    const err = new Error(problem);
    err.statusCode = 400;
    throw err;
  }
  return manager;
}

// Only HR creates departments and picks the manager
router.post(
  "/",
  protect,
  authorize("hr"),
  validate(createDepartmentSchema),
  asyncHandler(async (req, res) => {
    const { name, schedule, managerId } = req.body;

    // HR picks the manager, otherwise HR manages it
    let manager = req.user;
    if (req.user.role === "hr" && managerId) {
      manager = await resolveManagerForAssignment(managerId, req.user);
    }

    const newDepartment = await Department.create({
      name,
      schedule,
      manager: manager._id,
      staff: [],
    });

    if (String(manager._id) !== String(req.user._id)) {
      await logAudit(
        req.user._id,
        "department.assign_manager",
        "Department",
        newDepartment._id,
        `Created "${name}" and assigned ${manager.name} as its manager`
      );
    }

    res.status(201).json(newDepartment);
  })
);

router.get(
  "/",
  protect,
  asyncHandler(async (req, res) => {
    let query = {};
    if (req.user.role === "manager") {
      query = { manager: req.user._id, isActive: { $ne: false } };
    } else if (req.user.role === "staff") {
      query = { staff: req.user._id, isActive: { $ne: false } };
    }
    // HR sees deactivated departments too so they can reactivate them

    const departments = await Department.find(query)
      .populate("manager", "name email")
      .populate(ACTIVE_STAFF);

    res.json(departments);
  })
);

router.get(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const department = await Department.findById(req.params.id)
      .populate("manager", "name email")
      .populate(ACTIVE_STAFF);

    if (!department) return res.status(404).json({ message: "Department not found" });
    res.json(department);
  })
);

// GET attendance-rate summary per staff member — powers low-attendance alerts
router.get(
  "/:id/summary",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const department = await Department.findById(req.params.id).populate(ACTIVE_STAFF);
    if (!department) return res.status(404).json({ message: "Department not found" });

    const isOwner = department.manager?.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "hr") {
      return res.status(403).json({ message: "You don't manage this department" });
    }

    const sessions = await Session.find({ department: req.params.id });
    const sessionIds = sessions.map((s) => s._id);
    const totalSessions = sessions.length;

    const records = await AttendanceRecord.find({
      session: { $in: sessionIds },
      ...ACTIVE_RECORD,
    });

    const summary = department.staff.map((staffMember) => {
      const staffRecords = records.filter(
        (r) => r.staff.toString() === staffMember._id.toString()
      );
      const present = staffRecords.filter((r) => r.status === "present").length;
      const late = staffRecords.filter((r) => r.status === "late").length;
      const absent = staffRecords.filter((r) => r.status === "absent").length;
      const excused = staffRecords.filter((r) => r.status === "excused").length;
      const countedPresent = present + late + excused;
      const rate = totalSessions > 0 ? Math.round((countedPresent / totalSessions) * 100) : null;

      return {
        staff: { _id: staffMember._id, name: staffMember.name, email: staffMember.email },
        totalSessions,
        present,
        late,
        absent,
        excused,
        rate,
      };
    });

    res.json({ departmentName: department.name, totalSessions, summary });
  })
);

// GET attendance trend and full history for the analytics chart and CSV export
router.get(
  "/:id/analytics",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const department = await Department.findById(req.params.id).populate(ACTIVE_STAFF);
    if (!department) return res.status(404).json({ message: "Department not found" });

    const isOwner = department.manager?.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "hr") {
      return res.status(403).json({ message: "You don't manage this department" });
    }

    const sessions = await Session.find({ department: req.params.id }).sort({ date: 1 });
    const sessionIds = sessions.map((s) => s._id);
    const records = await AttendanceRecord.find({
      session: { $in: sessionIds },
      ...ACTIVE_RECORD,
    }).populate("staff", "name email staffId");

    const totalStaff = department.staff.length;

    const trend = sessions.map((session) => {
      const sessionRecords = records.filter(
        (r) => r.session.toString() === session._id.toString()
      );
      const present = sessionRecords.filter((r) => r.status === "present").length;
      const late = sessionRecords.filter((r) => r.status === "late").length;
      const absent = sessionRecords.filter((r) => r.status === "absent").length;
      const excused = sessionRecords.filter((r) => r.status === "excused").length;
      const countedPresent = present + late + excused;
      const rate = totalStaff > 0 ? Math.round((countedPresent / totalStaff) * 100) : null;

      return {
        sessionId: session._id,
        date: session.date,
        present,
        late,
        absent,
        excused,
        rate,
      };
    });

    // Flat list of every record across all sessions
    const fullHistory = records
      .map((r) => {
        const session = sessions.find((s) => s._id.toString() === r.session.toString());
        return {
          staffName: r.staff?.name || "—",
          staffEmail: r.staff?.email || "—",
          date: session?.date || null,
          status: r.status,
          checkIn: r.timestamp,
          checkOut: r.checkOutTime,
          hoursWorked: r.hoursWorked,
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({ departmentName: department.name, totalStaff, trend, fullHistory });
  })
);

// GET total hours per staff member in a date range
router.get(
  "/:id/payroll",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const department = await Department.findById(req.params.id).populate(ACTIVE_STAFF);
    if (!department) return res.status(404).json({ message: "Department not found" });

    const isOwner = department.manager?.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "hr") {
      return res.status(403).json({ message: "You don't manage this department" });
    }

    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: "from and to query params are required (YYYY-MM-DD)" });
    }

    // Add a local time so a bare date isn't parsed as UTC
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T23:59:59.999`);

    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({ message: "from and to must be valid dates" });
    }

    const sessions = await Session.find({
      department: req.params.id,
      date: { $gte: fromDate, $lte: toDate },
    });
    const sessionIds = sessions.map((s) => s._id);

    const records = await AttendanceRecord.find({
      session: { $in: sessionIds },
      ...ACTIVE_RECORD,
    });

    const payroll = department.staff.map((staffMember) => {
      const staffRecords = records.filter(
        (r) => r.staff.toString() === staffMember._id.toString()
      );
      // Absent/excused records don't count as hours
      const workedRecords = staffRecords.filter(
        (r) => r.status !== "absent" && r.status !== "excused"
      );
      const totalHours = workedRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
      const sessionsWorked = workedRecords.filter((r) => r.hoursWorked != null).length;

      return {
        staff: {
          _id: staffMember._id,
          name: staffMember.name,
          email: staffMember.email,
          staffId: staffMember.staffId,
        },
        totalHours: Math.round(totalHours * 100) / 100,
        sessionsWorked,
      };
    });

    res.json({
      departmentName: department.name,
      from: fromDate,
      to: toDate,
      totalSessions: sessions.length,
      payroll,
    });
  })
);

// HR changes the department's manager; the previous manager loses access
router.put(
  "/:id/manager",
  protect,
  authorize("hr"),
  validate(assignManagerSchema),
  asyncHandler(async (req, res) => {
    const department = await Department.findById(req.params.id).populate("manager", "name");
    if (!department) return res.status(404).json({ message: "Department not found" });

    const newManager = await resolveManagerForAssignment(req.body.managerId, req.user);
    const previousName = department.manager?.name || "nobody";

    department.manager = newManager._id;
    await department.save();

    await logAudit(
      req.user._id,
      "department.assign_manager",
      "Department",
      department._id,
      `Changed manager of "${department.name}" from ${previousName} to ${newManager.name}`
    );

    const updated = await Department.findById(department._id)
      .populate("manager", "name email")
      .populate(ACTIVE_STAFF);
    res.json(updated);
  })
);

router.post(
  "/:id/enroll",
  protect,
  authorize("manager", "hr"),
  validate(enrollSchema),
  asyncHandler(async (req, res) => {
    const { staffId } = req.body;
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ message: "Department not found" });

    const isOwner = department.manager?.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "hr") {
      return res.status(403).json({ message: "You don't manage this department" });
    }

    if (!department.isActive) {
      return res.status(400).json({ message: "This department has been deactivated" });
    }

    if (department.staff.includes(staffId)) {
      return res.status(400).json({ message: "Staff member is already assigned" });
    }

    // A staff member can only be in one active department
    const otherDepartment = await Department.findOne({
      _id: { $ne: department._id },
      isActive: { $ne: false },
      staff: staffId,
    }).select("name");
    if (otherDepartment) {
      return res.status(400).json({
        message: `This staff member is already enrolled in "${otherDepartment.name}". A staff member can only belong to one department.`,
      });
    }

    department.staff.push(staffId);
    await department.save();

    res.json(department);
  })
);

router.put(
  "/:id",
  protect,
  authorize("manager", "hr"),
  validate(updateDepartmentSchema),
  asyncHandler(async (req, res) => {
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ message: "Department not found" });

    const isOwner = department.manager?.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "hr") {
      return res.status(403).json({ message: "You don't manage this department" });
    }

    if (!department.isActive) {
      return res.status(400).json({ message: "This department has been deactivated" });
    }

    const { name, schedule } = req.body;
    if (name) department.name = name;
    if (schedule !== undefined) department.schedule = schedule;
    await department.save();

    res.json(department);
  })
);

// Soft delete: sets isActive to false and keeps history
router.delete(
  "/:id",
  protect,
  authorize("hr"),
  asyncHandler(async (req, res) => {
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ message: "Department not found" });

    if (!department.isActive) {
      return res.status(400).json({ message: "This department is already deactivated" });
    }

    department.isActive = false;
    await department.save();

    await logAudit(
      req.user._id,
      "department.deactivate",
      "Department",
      department._id,
      `Deactivated department: ${department.name}`
    );

    res.json({ message: "Department deactivated successfully" });
  })
);

router.put(
  "/:id/reactivate",
  protect,
  authorize("hr"),
  asyncHandler(async (req, res) => {
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ message: "Department not found" });

    if (department.isActive) {
      return res.status(400).json({ message: "This department is already active" });
    }

    department.isActive = true;
    await department.save();

    await logAudit(
      req.user._id,
      "department.reactivate",
      "Department",
      department._id,
      `Reactivated department: ${department.name}`
    );

    res.json({ message: "Department reactivated successfully" });
  })
);

module.exports = router;
