const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    token_number: { type: Number, required: true },
    status: {
      type: String,
      enum: ["waiting", "serving", "completed", "cancelled"],
      default: "waiting",
      index: true,
    },
    customerName: { type: String, default: "Customer" },
    service: { type: String, default: "General" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

tokenSchema.index({ business_id: 1, token_number: 1 }, { unique: true });

module.exports = mongoose.model("Token", tokenSchema);
