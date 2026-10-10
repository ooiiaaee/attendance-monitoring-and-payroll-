// Usage: router.post("/", validate(loginSchema), asyncHandler(async (req, res) => {...}))
// On success, req.body is replaced with the parsed (and type-coerced) data.
// On failure, responds 400 with a readable message — never reaches the route.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.errors
      .map((e) => `${e.path.join(".") || "body"}: ${e.message}`)
      .join("; ");
    return res.status(400).json({ message });
  }
  req.body = result.data;
  next();
};

module.exports = validate;
