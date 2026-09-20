const express = require("express");
const router = express.Router();
const Department = require("../models/Department");
const Session = require("../models/Session");
const AttendanceRecord = require("../models/AttendanceRecord");
const { protect, authorize } = require("../middleware/authMiddleware");
const { logAudit } = require("../utils/auditLog");

router.post("/", protect, authorize("manager", "hr"), async (req, res) => {
  try {
    const { name, schedule } = req.body;
    if (!name) return res.status(400).json({ message: "Department name is required" });

    const newDepartment = await Department.create({
      name,
      schedule,
      manager: req.user._id,
      staff: [],
    });

    res.status(201).json(newDepartment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/", protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "manager") {
      query = { manager: req.user._id };
    } else if (req.user.role === "staff") {
      query = { staff: req.user._id };
    }

    const departments = await Department.find(query)
      .populate("manager", "name email")
      .populate("staff", "name email staffId");

    res.json(departments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id", protect, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate("manager", "name email")
      .populate("staff", "name email staffId");

    if (!department) return res.status(404).json({ message: "Department not found" });
    res.json(department);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET attendance-rate summary per staff member — powers low-attendance alerts
router.get("/:id/summary", protect, authorize("manager", "hr"), async (req, res) => {
  try {
    const department = await Department.findById(req.params.id).populate(
      "staff",
      "name email staffId"
    );
    if (!department) return res.status(404).json({ message: "Department not found" });

    const sessions = await Session.find({ department: req.params.id });
    const sessionIds = sessions.map((s) => s._id);
    const totalSessions = sessions.length;

    const records = await AttendanceRecord.find({ session: { $in: sessionIds } });

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
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET session-by-session attendance trend + full history — powers the
// analytics chart and the "export full history" CSV on the department page.
router.get("/:id/analytics", protect, authorize("manager", "hr"), async (req, res) => {
  try {
    const department = await Department.findById(req.params.id).populate(
      "staff",
      "name email staffId"
    );
    if (!department) return res.status(404).json({ message: "Department not found" });

    const isOwner = department.manager.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "hr") {
      return res.status(403).json({ message: "You don't manage this department" });
    }

    const sessions = await Session.find({ department: req.params.id }).sort({ date: 1 });
    const sessionIds = sessions.map((s) => s._id);
    const records = await AttendanceRecord.find({ session: { $in: sessionIds } }).populate(
      "staff",
      "name email staffId"
    );

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
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET total hours worked per staff member within a date range — a
// payroll-ready summary, not per-session detail.
router.get("/:id/payroll", protect, authorize("manager", "hr"), async (req, res) => {
  try {
    const department = await Department.findById(req.params.id).populate(
      "staff",
      "name email staffId"
    );
    if (!department) return res.status(404).json({ message: "Department not found" });

    const isOwner = department.manager.toString() === req.user._id.toString();
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

    const records = await AttendanceRecord.find({ session: { $in: sessionIds } });

    const payroll = department.staff.map((staffMember) => {
      const staffRecords = records.filter(
        (r) => r.staff.toString() === staffMember._id.toString()
      );
      const totalHours = staffRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
      const sessionsWorked = staffRecords.filter((r) => r.hoursWorked != null).length;

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
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/enroll", protect, authorize("manager", "hr"), async (req, res) => {
  try {
    const { staffId } = req.body;
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ message: "Department not found" });

    if (department.staff.includes(staffId)) {
      return res.status(400).json({ message: "Staff member is already assigned" });
    }

    department.staff.push(staffId);
    await department.save();

    res.json(department);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:id", protect, authorize("manager", "hr"), async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ message: "Department not found" });

    const isOwner = department.manager.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== "hr") {
      return res.status(403).json({ message: "You don't manage this department" });
    }

    const { name, schedule } = req.body;
    if (name) department.name = name;
    if (schedule !== undefined) department.schedule = schedule;
    await department.save();

    res.json(department);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", protect, authorize("hr"), async (req, res) => {
  try {
    const deleted = await Department.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Department not found" });

    await logAudit(
      req.user._id,
      "department.delete",
      "Department",
      deleted._id,
      `Deleted department: ${deleted.name}`
    );

    res.json({ message: "Department deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
