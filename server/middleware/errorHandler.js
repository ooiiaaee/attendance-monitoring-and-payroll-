// Handles errors from all routes; registered last in server.js
function errorHandler(err, req, res, next) {
  // Log the full error, don't send it to the client
  console.error(`[${req.method} ${req.originalUrl}]`, err);

  // Mongoose validation errors are safe to show
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(", ") });
  }

  // Invalid ObjectId
  if (err.name === "CastError") {
    return res.status(400).json({ message: `Invalid ${err.path}` });
  }

  // Duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "value";
    return res.status(409).json({ message: `That ${field} is already in use` });
  }

  // zod validation errors
  if (err.name === "ZodError") {
    const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
    return res.status(400).json({ message: messages.join(", ") });
  }

  const status = err.statusCode || 500;
  // Show the real error outside production
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
