// Validates req.body against a zod schema
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
