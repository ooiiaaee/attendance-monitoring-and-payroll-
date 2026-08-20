// Run this ONCE from your server folder to create the first admin account:
//   node scripts/seedAdmin.js
//
// This does NOT go through the public /register endpoint, so it's the only
// way an admin account should ever be created from scratch. After this,
// use the Admin Panel (logged in as this account) to create any further
// admin or teacher accounts.

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// CHANGE THESE before running, or better, change the password immediately
// after your first login.
const ADMIN_NAME = "System Admin";
const ADMIN_EMAIL = "admin@school.edu";
const ADMIN_PASSWORD = "ChangeMe123";

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log(`An admin already exists: ${existingAdmin.email}`);
      console.log("Refusing to create a second one via this script.");
      process.exit(0);
    }

    const existingEmail = await User.findOne({ email: ADMIN_EMAIL });
    if (existingEmail) {
      console.log(`A user with email ${ADMIN_EMAIL} already exists. Pick a different email above.`);
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);

    const admin = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: "admin",
    });

    console.log("Admin account created:");
    console.log(`  Email: ${admin.email}`);
    console.log(`  Password: ${ADMIN_PASSWORD}  (change this after logging in!)`);
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
}

seed();
