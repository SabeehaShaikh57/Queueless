const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/queueless";

async function connectDB() {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    });
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("MongoDB connection failed", err.message || err);
    process.exit(1);
  }
}

module.exports = { mongoose, connectDB };
