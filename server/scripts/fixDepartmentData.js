// Cleans up department data: one department per staff member and realistic schedules.
// Usage: node scripts/fixDepartmentData.js (dry run), add --apply to save changes
// Optional flags: --skip-schedules, --skip-enrollment

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");


const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const blocks = (days, startTime, endTime) => days.map((day) => ({ day, startTime, endTime }));

// First matching preset wins, so specific patterns come first
const SCHEDULE_PRESETS = [
  {
    label: "Warehouse / production — early shift, Mon–Sat 06:00–15:00",
    match: /warehouse|logistic|production|manufactur|plant|dispatch/i,
    build: () => blocks([...WEEKDAYS, "Sat"], "06:00", "15:00"),
  },
  {
    label: "Sales / marketing — Mon–Fri 08:30–17:30, Sat half-day 09:00–12:00",
    match: /sales|marketing|business dev/i,
    build: () => [...blocks(WEEKDAYS, "08:30", "17:30"), ...blocks(["Sat"], "09:00", "12:00")],
  },
  {
    label: "Support / operations — Mon–Fri 08:00–17:00, Sat half-day 08:00–12:00",
    match: /support|customer|service|operation|\bops\b|help ?desk/i,
    build: () => [...blocks(WEEKDAYS, "08:00", "17:00"), ...blocks(["Sat"], "08:00", "12:00")],
  },
  {
    label: "HR / admin / finance — Mon–Fri 08:00–17:00",
    match: /\bhr\b|human|admin|finance|account|payroll|legal|procure/i,
    build: () => blocks(WEEKDAYS, "08:00", "17:00"),
  },
  {
    label: "Engineering / IT — Mon–Fri 09:00–18:00",
    match: /engineer|develop|\bdev\b|\bit\b|tech|software|\bqa\b|quality|data|design|\bui\b|\bux\b|research/i,
    build: () => blocks(WEEKDAYS, "09:00", "18:00"),
  },
];

const DEFAULT_PRESET = {
  label: "General office — Mon–Fri 09:00–18:00",
  build: () => blocks(WEEKDAYS, "09:00", "18:00"),
};

function presetFor(departmentName) {
  return SCHEDULE_PRESETS.find((p) => p.match.test(departmentName || "")) || DEFAULT_PRESET;
}

function describeSchedule(schedule) {
  if (!schedule || schedule.length === 0) return "(none)";
  return schedule.map((b) => `${b.day} ${b.startTime}-${b.endTime}`).join(", ");
}

// Decides which department each multiply-enrolled staff member keeps
function planEnrollment(departments, recordCounts) {
  const deptsByStaff = new Map(); // staffId -> [department, ...]
  for (const d of departments) {
    for (const id of new Set(d.staff.map(String))) {
      if (!deptsByStaff.has(id)) deptsByStaff.set(id, []);
      deptsByStaff.get(id).push(d);
    }
  }

  const keepDept = new Map(); // staffId -> deptId (as string)
  const removals = []; // { staffId, fromDeptId, fromDeptName, keptDeptName }

  for (const [staffId, depts] of deptsByStaff) {
    if (depts.length === 1) {
      keepDept.set(staffId, String(depts[0]._id));
      continue;
    }
    const ranked = [...depts].sort((a, b) => {
      const ca = recordCounts.get(`${staffId}|${a._id}`) || 0;
      const cb = recordCounts.get(`${staffId}|${b._id}`) || 0;
      if (cb !== ca) return cb - ca; // most history first
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0); // then oldest
    });
    const winner = ranked[0];
    keepDept.set(staffId, String(winner._id));
    for (const loser of ranked.slice(1)) {
      removals.push({
        staffId,
        fromDeptId: String(loser._id),
        fromDeptName: loser.name,
        keptDeptName: winner.name,
      });
    }
  }

  const newStaffLists = new Map();
  for (const d of departments) {
    const original = d.staff.map(String);
    const next = [...new Set(original)].filter((id) => keepDept.get(id) === String(d._id));
    newStaffLists.set(String(d._id), next);
  }

  return { newStaffLists, removals };
}

module.exports = { presetFor, planEnrollment, describeSchedule, SCHEDULE_PRESETS, DEFAULT_PRESET };


async function main() {
  const APPLY = process.argv.includes("--apply");
  const SKIP_SCHEDULES = process.argv.includes("--skip-schedules");
  const SKIP_ENROLLMENT = process.argv.includes("--skip-enrollment");

  const Department = require("../models/Department");
  const Session = require("../models/Session");
  const AttendanceRecord = require("../models/AttendanceRecord");
  const User = require("../models/User");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");
  console.log(APPLY ? "MODE: APPLY (changes will be written)\n" : "MODE: DRY RUN (nothing will be changed)\n");

  const departments = await Department.find({ isActive: { $ne: false } }).lean();
  console.log(`Found ${departments.length} active department(s).\n`);

  // Backup before writing
  if (APPLY) {
    const all = await Department.find({}).lean();
    const file = path.join(
      __dirname,
      `backup-departments-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );
    fs.writeFileSync(file, JSON.stringify(all, null, 2));
    console.log(`Backup saved: ${file}\n`);
  }

  // 1. One department per staff member
  if (!SKIP_ENROLLMENT) {
    console.log("=== Enrollment: one department per staff member ===");

    const counts = await AttendanceRecord.aggregate([
      { $match: { isActive: { $ne: false } } },
      {
        $lookup: {
          from: Session.collection.name,
          localField: "session",
          foreignField: "_id",
          as: "s",
        },
      },
      { $unwind: "$s" },
      { $group: { _id: { staff: "$staff", dept: "$s.department" }, n: { $sum: 1 } } },
    ]);
    const recordCounts = new Map(counts.map((c) => [`${c._id.staff}|${c._id.dept}`, c.n]));

    const { newStaffLists, removals } = planEnrollment(departments, recordCounts);

    const users = await User.find({ _id: { $in: removals.map((r) => r.staffId) } }).select("name");
    const nameOf = new Map(users.map((u) => [String(u._id), u.name]));

    if (removals.length === 0) {
      console.log("Nobody is enrolled in more than one department. Nothing to fix.");
    } else {
      for (const r of removals) {
        console.log(
          `  ${nameOf.get(r.staffId) || r.staffId}: stays in "${r.keptDeptName}", removed from "${r.fromDeptName}"`
        );
      }
    }

    // Also removes duplicate entries within a department
    const changed = departments.filter((d) => {
      const next = newStaffLists.get(String(d._id));
      const cur = d.staff.map(String);
      return next.length !== cur.length;
    });

    if (APPLY) {
      for (const d of changed) {
        await Department.updateOne({ _id: d._id }, { $set: { staff: newStaffLists.get(String(d._id)) } });
      }
      console.log(`  -> updated ${changed.length} department(s).\n`);
    } else {
      console.log(`  -> would update ${changed.length} department(s).\n`);
    }
  }

  // 2. Department schedules
  if (!SKIP_SCHEDULES) {
    console.log("=== Schedules ===");
    for (const d of departments) {
      const preset = presetFor(d.name);
      const next = preset.build();
      console.log(`  "${d.name}"`);
      console.log(`      was: ${describeSchedule(d.schedule)}`);
      console.log(`      now: ${preset.label}`);
      if (APPLY) await Department.updateOne({ _id: d._id }, { $set: { schedule: next } });
    }
    console.log(APPLY ? "\n  -> schedules updated.\n" : "\n  -> (not applied)\n");
  }

  if (!APPLY) console.log("DRY RUN finished. If this looks right, run again with --apply");
  else console.log("Done.");

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
}
