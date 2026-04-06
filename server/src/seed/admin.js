const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const connectDB = require("../config/db");
const User = require("../models/User");

dotenv.config();

async function seedAdmin() {
  const name = process.env.ADMIN_NAME || "Admin";
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }

  await connectDB();

  const hashedPassword = await bcrypt.hash(password, 10);

  await User.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    {
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: "admin",
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  console.log(`Admin user ready: ${email}`);
  process.exit(0);
}

seedAdmin().catch((error) => {
  console.error("Failed to seed admin:", error);
  process.exit(1);
});
