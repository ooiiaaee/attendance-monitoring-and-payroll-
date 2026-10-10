// Registered last in server.js, after every route. Anything passed to
// next(err) — including errors thrown inside an asyncHandler-wrapped route —
// ends up here instead of Express's default HTML error page or a route
// manually echoing error.message (which can leak Mongoose/Mongo internals
// straight to the client).
function errorHandler(err, req, res, next) {
  // Full detail goes to the server log, never to the response.
  console.error(`[${req.method} ${req.originalUrl}]`, err);

  // Mongoose validation errors are safe (and useful) to show as-is — they're
  // just "name is required" style messages, not internal detail.
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(", ") });
  }

  // Malformed ObjectId in a route param (e.g. GET /departments/not-an-id).
  if (err.name === "CastError") {
    return res.status(400).json({ message: `Invalid ${err.path}` });
  }

  // Duplicate key (unique index) violation.
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "value";
    return res.status(409).json({ message: `That ${field} is already in use` });
  }

  // zod validation errors (see utils/validate.js).
  if (err.name === "ZodError") {
    const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    return res.status(400).json({ message: messages.join(", ") });
  }

  // A route can still throw a deliberate error with a specific status, e.g.
  // throw Object.assign(new Error("Not found"), { statusCode: 404 });
  const status = err.statusCode || 500;
  // In production the client only ever sees a generic message. While developing
  // (NODE_ENV not "production") the real cause is included, so a 500 shows up
  // as e.g. "Something went wrong: Cannot read properties of null" instead of
  // forcing a trip to the server terminal.
  const generic = "Something went wrong. Please try again.";
  const message =
    status !== 500
      ? err.message
      : process.env.NODE_ENV === "production"
        ? generic
        : `${generic} (${err.message})`;
  res.status(status).json({ message });
}

module.exports = errorHandler;
