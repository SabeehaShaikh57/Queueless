
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Admin = require("../models/Admin");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => String(value || "").toLowerCase().trim();

const toSafeUser = (account) => ({
  id: account._id.toString(),
  name: account.name,
  email: account.email,
  role: account.role,
});

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET || "queueless_secret", { expiresIn: "24h" });

exports.register = async (req,res)=>{
  try {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const [existingUser, existingAdmin] = await Promise.all([
      User.findOne({ email }),
      Admin.findOne({ email }),
    ]);

    if (existingUser || existingAdmin) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const created = await User.create({ name, email, password: hashed, role: "customer" });

    const user = toSafeUser(created);
    const token = signToken({ id: user.id, role: user.role, accountType: "user" });

    res.status(201).json({ message: "User registered", token, user });
  } catch (err) {
    return res.status(500).json({ message: "Registration failed" });
  }
};

exports.login = async (req,res)=>{
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const role = String(req.body?.role || "customer").toLowerCase().trim();

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (role === "admin") {
      const admin = await Admin.findOne({ email });

      if (!admin) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const validAdminPassword = await bcrypt.compare(password, admin.password);
      if (!validAdminPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const safeAdmin = toSafeUser(admin);
      const adminToken = signToken({ id: safeAdmin.id, role: "admin", accountType: "admin" });

      return res.json({ token: adminToken, user: safeAdmin });
    }

    const user = await User.findOne({ email });

    if(!user){
      return res.status(401).json({message:"Invalid email or password"});
    }

    const valid = await bcrypt.compare(password,user.password);

    if(!valid){
      return res.status(401).json({message:"Invalid email or password"});
    }

    const safeUser = toSafeUser(user);
    const token = signToken({ id: safeUser.id, role: safeUser.role, accountType: "user" });

    res.json({token, user: safeUser});
  } catch (err) {
    return res.status(500).json({ message: "Login failed" });
  }
};

exports.me = async (req, res) => {
  return res.json({ user: req.user });
};

exports.logout = async (req, res) => {
  return res.json({ message: "Logged out" });
};
