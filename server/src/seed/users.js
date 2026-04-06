const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const connectDB = require("../config/db");
const User = require("../models/User");

dotenv.config();

async function upsertUser({ name, email, password, role }) {
  if (!name || !email || !password || !role) {
    throw new Error(`Missing required values for ${role} user`);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const hashedPassword = await bcrypt.hash(password, 10);

  await User.findOneAndUpdate(
    { email: normalizedEmail },
    {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  console.log(`${role} user ready: ${normalizedEmail}`);
}

async function seedUsers() {
  await connectDB();

  await upsertUser({
    name: process.env.ADMIN_NAME || "Delight Admin",
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: "admin",
  });

  await upsertUser({
    name: process.env.MANAGER_NAME || "Delight Manager",
    email: process.env.MANAGER_EMAIL,
    password: process.env.MANAGER_PASSWORD,
    role: "manager",
  });

  console.log("Users collection initialized successfully");
  process.exit(0);
}

seedUsers().catch((error) => {
  console.error("Failed to seed users:", error);
  process.exit(1);
});
