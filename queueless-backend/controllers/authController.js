
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.register = async (req,res)=>{
  try {
    const {name,email,password} = req.body;

    const existing = await User.findOne({ email: String(email || "").toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: "User already exists" });

    const hashed = bcrypt.hashSync(password,8);
    await User.create({ name, email, password: hashed, role: "customer" });

    res.json({message:"User registered"});
  } catch (err) {
    return res.status(500).json(err);
  }
};

exports.login = async (req,res)=>{
  try {
    const {email,password} = req.body;

    const user = await User.findOne({ email: String(email || "").toLowerCase().trim() });

    if(!user){
      return res.status(404).json({message:"User not found"});
    }

    const valid = bcrypt.compareSync(password,user.password);

    if(!valid){
      return res.status(401).json({message:"Invalid password"});
    }

    const token = jwt.sign({id:user._id},process.env.JWT_SECRET || "queueless_secret");

    res.json({token});
  } catch (err) {
    return res.status(500).json(err);
  }
};
