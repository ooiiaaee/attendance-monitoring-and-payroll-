// Creates the first HR admin account. Run once: node scripts/seedAdmin.js

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// Change these before running
const HR_ADMIN_NAME = "HR Admin";
const HR_ADMIN_EMAIL = "hr@company.com";
const HR_ADMIN_PASSWORD = "ChangeMe123";

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

      const existingHR = await User.findOne({ role: "hr" });
   if (existingHR) {
     console.log(`An HR admin already exists: ${existingHR.email}`);
     process.exit(0);
   }

    const existingEmail = await User.findOne({ email: HR_ADMIN_EMAIL });
    if (existingEmail) {
      console.log(`A user with email ${HR_ADMIN_EMAIL} already exists. Pick a different email above.`);
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(HR_ADMIN_PASSWORD, salt);

    const hrAdmin = await User.create({
      name: HR_ADMIN_NAME,
      email: HR_ADMIN_EMAIL,
      password: hashedPassword,
      role: "hr",
    });

    console.log("HR admin account created:");
    console.log(`  Email: ${hrAdmin.email}`);
    console.log(`  Password: ${HR_ADMIN_PASSWORD}  (change this after logging in!)`);
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
}

seed();
