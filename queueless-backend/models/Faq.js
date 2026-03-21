const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    askedBy: { type: String, required: true, trim: true },
    answer: { type: String, default: null },
    answeredAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: "askedAt", updatedAt: "updatedAt" } }
);

module.exports = mongoose.model("Faq", faqSchema);
