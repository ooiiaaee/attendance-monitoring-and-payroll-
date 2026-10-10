const express = require("express");
const { z } = require("zod");
const router = express.Router();
const Department = require("../models/Department");
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
});

const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1).optional(),
  schedule: z.array(scheduleBlockSchema).optional(),
});

const enrollSchema = z.object({
  staffId: z.string().min(1, "staffId is required"),
});

// Only used internally by AttendanceRecord queries below — excludes
// soft-deleted (corrected/removed) records from every roll-up, same
// $ne:false reasoning as everywhere else this pattern is used.
const ACTIVE_RECORD = { isActive: { $ne: false } };

router.post(
  "/",
  protect,
  authorize("manager", "hr"),
  validate(createDepartmentSchema),
  asyncHandler(async (req, res) => {
    const { name, schedule } = req.body;

    const newDepartment = await Department.create({
      name,
      schedule,
      manager: req.user._id,
      staff: [],
    });

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
    // HR gets no isActive filter at all — same as GET /auth/users — so
    // deactivated departments still show up in the Admin Panel to be
    // reactivated, they just disappear from managers'/staff's own views.

    const departments = await Department.find(query)
      .populate("manager", "name email")
      .populate("staff", "name email staffId");

    res.json(departments);
  })
);

router.get(
  "/:id",
  protect,
  asyncHandler(async (req, res) => {
    const department = await Department.findById(req.params.id)
      .populate("manager", "name email")
      .populate("staff", "name email staffId");

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
    const department = await Department.findById(req.params.id).populate(
      "staff",
      "name email staffId"
    );
    if (!department) return res.status(404).json({ message: "Department not found" });

    // This was previously missing — any manager (not just this department's
    // own) could pull another department's full attendance summary.
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

// GET session-by-session attendance trend + full history — powers the
// analytics chart and the "export full history" CSV on the department page.
router.get(
  "/:id/analytics",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const department = await Department.findById(req.params.id).populate(
      "staff",
      "name email staffId"
    );
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

    // Flat list of every record across every session — the full department
    // history, not just one session's worth (that's what AttendanceSheet's
    // CSV export already covers).
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

// GET total hours worked per staff member within a date range — a
// payroll-ready summary, not per-session detail.
router.get(
  "/:id/payroll",
  protect,
  authorize("manager", "hr"),
  asyncHandler(async (req, res) => {
    const department = await Department.findById(req.params.id).populate(
      "staff",
      "name email staffId"
    );
    if (!department) return res.status(404).json({ message: "Department not found" });

    const isOwner = department.manager?.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "hr") {
      return res.status(403).json({ message: "You don't manage this department" });
    }

    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ message: "from and to query params are required (YYYY-MM-DD)" });
    }

    // Parsing a bare "YYYY-MM-DD" string makes JS Date treat it as UTC
    // midnight, which shifts the boundary by the server's UTC offset.
    // Appending an explicit local time avoids that.
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
      // Absent/excused records never count as hours worked (older records may
      // still carry hours from before this rule existed).
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

router.post(
  "/:id/enroll",
  protect,
  authorize("manager", "hr"),
  validate(enrollSchema),
  asyncHandler(async (req, res) => {
    const { staffId } = req.body;
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ message: "Department not found" });

    // This was previously missing — any manager could enroll staff into any
    // department, not just their own.
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

    // A staff member can belong to only ONE department at a time. Departments
    // that have been deactivated don't count — those staff are free again.
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

// Soft delete — mirrors the User.isActive pattern. Sets isActive: false
// instead of removing the document, so every historical reference to this
// department (sessions, attendance records, leave requests, and the
// department's own staff/manager assignments) stays intact and still
// resolves correctly when populated. It just disappears from managers' and
// staff's own department views (see GET / above) and can't be modified
// further (see the enroll/update guards above) until reactivated.
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
