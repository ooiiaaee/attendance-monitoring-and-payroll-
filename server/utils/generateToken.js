const jwt = require("jsonwebtoken");

const generateToken = (userId, role, tokenVersion = 0) => {
  return jwt.sign({ id: userId, role, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

module.exports = generateToken;
