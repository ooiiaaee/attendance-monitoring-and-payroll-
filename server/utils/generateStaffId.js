const crypto = require("crypto");
const User = require("../models/User");

// Staff IDs look like "STF-482913": a prefix plus 6 random digits, checked for uniqueness
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
