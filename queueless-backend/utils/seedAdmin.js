const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");

async function seedAdminFromEnv() {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "").trim();
  const name = String(process.env.ADMIN_NAME || "QueueLess Admin").trim();

  if (!email || !password) {
    return;
  }

  const existing = await Admin.findOne({ email });
  if (existing) return;

  const hashed = await bcrypt.hash(password, 10);
  await Admin.create({ name, email, password: hashed });
  console.log(`Seeded admin account for ${email}`);
}

module.exports = { seedAdminFromEnv };
