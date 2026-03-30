const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    hours: { type: String, trim: true },
    services: [
      {
        name: { type: String, trim: true },
        estTime: { type: Number, default: 15 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Business", businessSchema);
