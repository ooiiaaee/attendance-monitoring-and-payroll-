const rateLimit = require("express-rate-limit");

// Keyed by IP by default. 10 attempts per 15 minutes is generous for a
// legitimate user who mistypes a password a few times, but meaningfully
// slows down a brute-force script.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
});

// A staff member scanning/re-scanning a QR a handful of times in a minute is
// normal; a script hammering the endpoint is not.
const checkinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many check-in attempts. Please slow down and try again." },
});

module.exports = { loginLimiter, checkinLimiter };
