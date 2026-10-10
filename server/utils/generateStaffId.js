const crypto = require("crypto");
const User = require("../models/User");

// Staff IDs look like "STF-482913": a fixed prefix plus 6 random digits.
// The number is random (not sequential) so IDs don't reveal how many staff
// exist or the order they signed up; uniqueness is checked against the
// database, and a collision just rolls a new number.
async function generateStaffId() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const digits = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const candidate = `STF-${digits}`;
    const taken = await User.exists({ staffId: candidate });
    if (!taken) return candidate;
  }
  throw new Error("Could not generate a unique Staff ID — please try again");
}

module.exports = { generateStaffId };
