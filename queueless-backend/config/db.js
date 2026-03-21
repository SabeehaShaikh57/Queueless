
const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/queueless";

mongoose
  .connect(uri)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB connection failed", err));

module.exports = mongoose;
