// One-time cleanup: gives sessions a dayKey and merges duplicate sessions on the same day.
// Usage: node scripts/fixSessionsPerDay.js (dry run), add --apply to save changes

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { dayKeyOf } = require("../utils/dayKey");


const COPY_FIELDS = [
  "status",
  "timestamp",
  "checkOutTime",
  "hoursWorked",
  "location",
  "distanceMeters",
  "flagged",
  "flagReason",
  "isActive",
];

// Higher = more worth keeping
function recordScore(r) {
  let score = 0;
  if (r.isActive !== false) score += 4;
  if (r.checkOutTime) score += 2;
  if (r.status === "present" || r.status === "late") score += 1;
  return score;
}

// Groups sessions by department and day
function groupByDay(sessions) {
  const groups = new Map();
  for (const s of sessions) {
    const key = `${s.department}|${s.dayKey || dayKeyOf(s.date)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return groups;
}

// Picks the session with the most records, then the earliest
function chooseKeeper(group, counts) {
  return [...group].sort((a, b) => {
    const diff = (counts.get(String(b._id)) || 0) - (counts.get(String(a._id)) || 0);
    return diff !== 0 ? diff : new Date(a.date) - new Date(b.date);
  })[0];
}

// Decides what happens to records of the sessions being merged
function planRecordMoves(keeper, others, recordsBySession) {
  const keeperRecords = recordsBySession.get(String(keeper._id)) || [];
  const byStaff = new Map(keeperRecords.map((r) => [String(r.staff), r]));
  const moves = []; // { recordId, toSession }
  const overwrites = []; // { keeperRecordId, fromRecord }
  const left = []; // records that stay on the old session (the loser of a conflict)

  for (const other of others) {
    for (const r of recordsBySession.get(String(other._id)) || []) {
      const mine = byStaff.get(String(r.staff));
      if (!mine) {
        moves.push({ recordId: r._id, toSession: keeper._id });
        byStaff.set(String(r.staff), { ...r, session: keeper._id });
      } else if (recordScore(r) > recordScore(mine)) {
        overwrites.push({ keeperRecordId: mine._id, fromRecord: r });
        byStaff.set(String(r.staff), { ...mine, ...r, _id: mine._id });
      } else {
        left.push(r._id);
      }
    }
  }
  return { moves, overwrites, left };
}

module.exports = { groupByDay, chooseKeeper, planRecordMoves, recordScore, COPY_FIELDS };


async function main() {
  const APPLY = process.argv.includes("--apply");
  const Session = require("../models/Session");
  const AttendanceRecord = require("../models/AttendanceRecord");
  const Department = require("../models/Department");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");
  console.log(APPLY ? "MODE: APPLY (changes will be written)\n" : "MODE: DRY RUN (nothing will be changed)\n");

  const sessions = await Session.find({ isActive: { $ne: false } }).lean();
  const departments = await Department.find({}).select("name").lean();
  const deptName = new Map(departments.map((d) => [String(d._id), d.name]));
  console.log(`Active sessions: ${sessions.length}`);

  const groups = groupByDay(sessions);
  const duplicates = [...groups.values()].filter((g) => g.length > 1);
  const missingDayKey = sessions.filter((s) => !s.dayKey);
  console.log(`Sessions without a day key yet: ${missingDayKey.length}`);
  console.log(`Days with more than one session:  ${duplicates.length}\n`);

  // Records of the sessions being merged
  const involvedIds = duplicates.flat().map((s) => s._id);
  const records = involvedIds.length
    ? await AttendanceRecord.find({ session: { $in: involvedIds } }).lean()
    : [];
  const recordsBySession = new Map();
  for (const r of records) {
    const k = String(r.session);
    if (!recordsBySession.has(k)) recordsBySession.set(k, []);
    recordsBySession.get(k).push(r);
  }
  const counts = new Map([...recordsBySession].map(([k, v]) => [k, v.length]));

  const work = [];
  for (const group of duplicates) {
    const keeper = chooseKeeper(group, counts);
    const others = group.filter((s) => String(s._id) !== String(keeper._id));
    const plan = planRecordMoves(keeper, others, recordsBySession);
    work.push({ keeper, others, plan });

    const when = new Date(keeper.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    console.log(`"${deptName.get(String(keeper.department)) || keeper.department}" — ${when}: ${group.length} sessions -> 1`);
    console.log(
      `    keeps the session from ${new Date(keeper.date).toLocaleTimeString()}; ` +
        `${plan.moves.length} record(s) moved, ${plan.overwrites.length} replaced by a better one, ` +
        `${plan.left.length} duplicate(s) left on the old session; ${others.length} session(s) set inactive`
    );
  }

  if (!APPLY) {
    console.log("\nDRY RUN finished. If this looks right, run again with --apply");
    return mongoose.disconnect();
  }

  // Backup, then write
  const file = path.join(__dirname, `backup-sessions-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify({ sessions: duplicates.flat(), records }, null, 2));
  console.log(`\nBackup saved: ${file}`);

  for (const { keeper, others, plan } of work) {
    for (const m of plan.moves) {
      await AttendanceRecord.updateOne({ _id: m.recordId }, { $set: { session: m.toSession } });
    }
    for (const o of plan.overwrites) {
      const fields = {};
      for (const f of COPY_FIELDS) if (o.fromRecord[f] !== undefined) fields[f] = o.fromRecord[f];
      await AttendanceRecord.updateOne({ _id: o.keeperRecordId }, { $set: fields });
    }
    await Session.updateMany({ _id: { $in: others.map((s) => s._id) } }, { $set: { isActive: false } });
  }

  // Set dayKey on the remaining active sessions
  const mergedAway = new Set(work.flatMap((w) => w.others.map((s) => String(s._id))));
  let stamped = 0;
  for (const s of sessions) {
    if (mergedAway.has(String(s._id)) || s.dayKey) continue;
    await Session.updateOne({ _id: s._id }, { $set: { dayKey: dayKeyOf(s.date) } });
    stamped++;
  }
  console.log(`Merged ${work.length} day(s); stamped ${stamped} session(s) with a day key. Done.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Failed:", err);
    process.exit(1);
  });
}
