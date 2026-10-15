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
const healthRoutes = require("./routes/healthRoutes");
const { startScheduler } = require("./utils/scheduler");

const app = express();

// Needed behind a hosting proxy so rate limits use the real client IP
app.set("trust proxy", 1);

connectDB();

// Allowed origins; set CLIENT_ORIGIN in .env (comma-separated for several)
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);
app.use(
  cors({
    // No Origin header: not a browser request (curl, health checks)
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

app.use("/api/health", healthRoutes);

// 404 for unmatched routes
app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Must be registered last
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // The scheduler needs an always-on server; enable with ENABLE_SCHEDULER=true
  if (process.env.ENABLE_SCHEDULER === "true") {
    startScheduler();
  }
});
