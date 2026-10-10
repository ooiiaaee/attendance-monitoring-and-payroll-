require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const noteRoutes = require("./routes/noteRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const auditRoutes = require("./routes/auditRoutes");
const errorHandler = require("./middleware/errorHandler");
const { startScheduler } = require("./utils/scheduler");

const app = express();

// Hosting platforms (Render, Railway, ...) put a proxy in front of the app.
// Without this, req.ip is the proxy's address for everyone, so the login /
// check-in rate limits would be shared by ALL users instead of per person.
app.set("trust proxy", 1);

connectDB();

// CORS used to accept requests from any origin (cors() with no options).
// Fine for local dev, but risky the moment this is reachable from anywhere
// public. Set CLIENT_ORIGIN in .env for whatever your frontend's real URL
// is in each environment; it falls back to the local dev server so nothing
// breaks if it's not set yet.
//
// CLIENT_ORIGIN can hold several origins separated by commas, e.g.
//   https://my-app.vercel.app,https://my-app.netlify.app,http://localhost:3000
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);
app.use(
  cors({
    // No Origin header = not a browser cross-site request (curl, health checks, same-origin).
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
    credentials: true,
  })
);
app.use(express.json({ limit: "300kb" })); // room for a resized avatar data URL

app.use("/api/auth", authRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/audit", auditRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running" });
});

// 404 for anything that didn't match a route above.
app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Must be registered last — catches errors from every asyncHandler-wrapped
// route (see utils/asyncHandler.js) instead of each route handling its own
// and leaking raw error.message to the client.
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // The auto-session generator needs a server that stays running (it checks
  // every minute), so it's opt-in: set ENABLE_SCHEDULER=true where the server
  // is always on. On serverless hosting leave it off.
  if (process.env.ENABLE_SCHEDULER === "true") {
    startScheduler();
  }
});
