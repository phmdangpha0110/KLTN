import mongoose from "mongoose";

const vipOrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  plan: { type: String, enum: ["1d", "1m"], required: true },
  amount: { type: Number, required: true },
  content: { type: String, required: true },
  orderId: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ["pending", "paid", "cancelled", "expired"],
    default: "pending",
    index: true,
  },
  adminNote: { type: String, default: "" },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  createdAt: { type: Date, default: Date.now },
  paidAt: { type: Date, default: null },
});

export default mongoose.model("VipOrder", vipOrderSchema);