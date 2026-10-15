const rateLimit = require("express-rate-limit");

// Login attempts: 10 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
});

// Check-in scans: 20 per minute
const checkinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many check-in attempts. Please slow down and try again." },
});

module.exports = { loginLimiter, checkinLimiter };
