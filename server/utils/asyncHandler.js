// Wraps an async route handler so any thrown error (or rejected promise) is
// forwarded to Express's error-handling middleware (see middleware/errorHandler.js)
// instead of every single route needing its own try/catch.
//
// Before:
//   router.get("/", async (req, res) => {
//     try { ... } catch (error) { res.status(500).json({ message: error.message }); }
//   });
//
// After:
//   router.get("/", asyncHandler(async (req, res) => { ... }));
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
