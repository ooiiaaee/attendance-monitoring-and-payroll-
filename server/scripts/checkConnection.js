// Checks the backend setup: settings, database, data, and optionally a login.
// Usage: npm run check, or npm run check -- --email you@example.com

require("dotenv").config();
const readline = require("readline");


// Checks the rules a login has to pass
async function verifyAccount(user, plainPassword, deps) {
  const { bcrypt, jwt, generateToken, secret } = deps;
  const checks = [];
  const add = (ok, label, detail) => checks.push({ ok, label, detail });

  add(!!user, "Account exists in the database");
  if (!user) return checks;

  add(user.isActive !== false, "Account is active (not deactivated)");
  add(user.role === "manager" ? user.approved !== false : true, "Account is approved to log in",
    user.role === "manager" ? undefined : "only managers need HR approval");

  const passwordOk = await bcrypt.compare(plainPassword, user.password);
  add(passwordOk, "Password matches the stored (hashed) password");
  if (!passwordOk) return checks;

  const token = generateToken(user._id, user.role, user.tokenVersion || 0);
  add(!!token, "A login token (JWT) can be issued");

  let decoded = null;
  try {
    decoded = jwt.verify(token, secret);
  } catch (e) {
    add(false, "The token verifies with JWT_SECRET", e.message);
    return checks;
  }
  add(true, "The token verifies with JWT_SECRET");
  add(String(decoded.id) === String(user._id), "The token identifies this account");
  add((decoded.tokenVersion || 0) === (user.tokenVersion || 0), "Token is current (not invalidated by a password change)");
  add(decoded.role === user.role, `Token carries the right role (${user.role})`);

  return checks;
}

function checkEnvironment(env) {
  const results = [];
  const add = (level, label, detail) => results.push({ level, label, detail }); // level: ok | warn | fail

  env.MONGO_URI ? add("ok", "MONGO_URI is set") : add("fail", "MONGO_URI is missing", "the server cannot reach MongoDB without it");

  if (!env.JWT_SECRET) {
    add("fail", "JWT_SECRET is missing", "logins cannot be signed or verified");
  } else if (env.JWT_SECRET === "change-me" || env.JWT_SECRET.length < 32) {
    add("warn", "JWT_SECRET is set but weak", "use 32+ random characters");
  } else {
    add("ok", "JWT_SECRET is set");
  }

  env.CLIENT_ORIGIN
    ? add("ok", "CLIENT_ORIGIN is set", "the website address the API will accept requests from")
    : add("warn", "CLIENT_ORIGIN is not set", "defaults to http://localhost:3000");

  return results;
}

module.exports = { verifyAccount, checkEnvironment };


const PASS = "[ OK ]";
const WARN = "[WARN]";
const FAIL = "[FAIL]";

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    const original = rl._writeToOutput;
    rl._writeToOutput = function (text) {
      if (rl.stdoutMuted) rl.output.write("*");
      else original.call(rl, text);
    };
    rl.question(question, (answer) => {
      rl.close();
      console.log("");
      resolve(answer);
    });
    rl.stdoutMuted = true;
  });
}

function argValue(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  let failures = 0;
  const show = (mark, text, detail) => console.log(`${mark} ${text}${detail ? `  (${detail})` : ""}`);

  // 1. Settings
  console.log("\n1. Settings (.env)");
  for (const r of checkEnvironment(process.env)) {
    show(r.level === "ok" ? PASS : r.level === "warn" ? WARN : FAIL, r.label, r.detail);
    if (r.level === "fail") failures++;
  }
  if (!process.env.MONGO_URI) {
    console.log("\nCannot continue without MONGO_URI.");
    process.exit(1);
  }

  const mongoose = require("mongoose");

  // 2. Database
  console.log("\n2. Database connection");
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    show(PASS, "Connected to MongoDB", `host: ${mongoose.connection.host}`);
    show(PASS, "Database name", mongoose.connection.name);

    const started = Date.now();
    await mongoose.connection.db.admin().ping();
    show(PASS, "Ping answered", `${Date.now() - started} ms`);
  } catch (error) {
    show(FAIL, "Could not connect to MongoDB", error.message);
    console.log("\n   Common causes: wrong username/password in MONGO_URI, your IP address");
    console.log("   isn't allowed in Atlas -> Network Access, or no internet connection.");
    process.exit(1);
  }

  // 3. Data
  console.log("\n3. Data");
  try {
    const User = require("../models/User");
    const Department = require("../models/Department");
    const Session = require("../models/Session");
    const AttendanceRecord = require("../models/AttendanceRecord");
    const LeaveRequest = require("../models/LeaveRequest");
    const PayrollPayment = require("../models/PayrollPayment");

    const [hr, managers, pending, staff, inactive, departments, sessions, records, leave, payments] =
      await Promise.all([
        User.countDocuments({ role: "hr" }),
        User.countDocuments({ role: "manager", approved: { $ne: false } }),
        User.countDocuments({ role: "manager", approved: false }),
        User.countDocuments({ role: "staff" }),
        User.countDocuments({ isActive: false }),
        Department.countDocuments({ isActive: { $ne: false } }),
        Session.countDocuments({ isActive: { $ne: false } }),
        AttendanceRecord.countDocuments({ isActive: { $ne: false } }),
        LeaveRequest.countDocuments({}),
        PayrollPayment.countDocuments({}),
      ]);
    show(hr > 0 ? PASS : WARN, `HR accounts: ${hr}`, hr > 0 ? undefined : "run: node scripts/seedAdmin.js");
    show(PASS, `Managers: ${managers}  (waiting for approval: ${pending})`);
    show(PASS, `Staff: ${staff}  (deactivated accounts: ${inactive})`);
    show(PASS, `Departments: ${departments}   Sessions: ${sessions}   Attendance records: ${records}`);
    show(PASS, `Leave requests: ${leave}   Payroll payments: ${payments}`);
  } catch (error) {
    show(FAIL, "Could not read the collections", error.message);
    failures++;
  }

  // 4. Account (optional)
  const email = argValue("email");
  if (email) {
    console.log(`\n4. Account login check for ${email}`);
    const password = argValue("password") ?? (await askHidden("   Password (typing is hidden): "));
    try {
      const User = require("../models/User");
      const user = await User.findOne({ email: email.trim().toLowerCase() });
      const checks = await verifyAccount(user, password, {
        bcrypt: require("bcryptjs"),
        jwt: require("jsonwebtoken"),
        generateToken: require("../utils/generateToken"),
        secret: process.env.JWT_SECRET,
      });
      for (const c of checks) {
        show(c.ok ? PASS : FAIL, c.label, c.detail);
        if (!c.ok) failures++;
      }
      if (user && checks.every((c) => c.ok)) {
        console.log(`\n   ${user.name} (${user.role}) can log in.`);
      }
    } catch (error) {
      show(FAIL, "Account check crashed", error.message);
      failures++;
    }
  } else {
    console.log("\n4. Account login check: skipped");
    console.log("   To test a login:  npm run check -- --email someone@example.com");
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
  await mongoose.disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Check failed unexpectedly:", error.message);
    process.exit(1);
  });
}
