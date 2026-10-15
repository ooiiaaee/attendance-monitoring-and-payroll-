const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

// mongoose.connection.readyState
const STATES = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

// GET /api/health - checks the API is up (doesn't touch the database)
router.get("/", (req, res) => {
  res.json({
    status: "Server is running",
    database: STATES[mongoose.connection.readyState] || "unknown",
  });
});

// GET /api/health/db - pings MongoDB and times it
router.get("/db", async (req, res) => {
  const state = STATES[mongoose.connection.readyState] || "unknown";

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ status: "error", database: { state, connected: false } });
  }

  try {
    const started = Date.now();
    await mongoose.connection.db.admin().ping();
    res.json({
      status: "ok",
      database: {
        state,
        connected: true,
        name: mongoose.connection.name,
        pingMs: Date.now() - started,
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      database: { state, connected: false },
      message: "Database did not answer the ping",
    });
  }
});

module.exports = router;
