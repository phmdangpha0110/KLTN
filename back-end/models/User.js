import mongoose from "mongoose";
import { softDeletePlugin } from "../utils/softDeletePlugin.js";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  avatar: String,
  bio: { type: String, default: "" },
  role: { type: String, enum: ["user", "author", "admin"], default: "user" },
  status: { type: String, enum: ["active", "suspended"], default: "active" },
  isDelete: { type: Boolean, default: false, index: true },
  postBanUntil: { type: Date, default: null },
  postBanReason: { type: String, default: "" },
  // 👇 THÊM 2 TRƯỜNG VIP
  isVip: { type: Boolean, default: false },         // kích hoạt VIP “mãi mãi”
  vipUntil: { type: Date, default: null },          // VIP có thời hạn

  // --- Thêm cho Forgot Password ---
  resetOtpHash: { type: String, default: null },    // hash OTP
  resetOtpExpires: { type: Date, default: null },   // hạn của OTP

  createdAt: { type: Date, default: Date.now },
  followAuthors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  googleId: { type: String, index: true, sparse: true },
  provider: { type: String, enum: ["local", "google"], default: "local" },

});

userSchema.plugin(softDeletePlugin);

// helper: coi là VIP nếu isVip = true hoặc vipUntil còn hạn
userSchema.methods.isVipNow = function () {
  if (this.vipUntil) return this.vipUntil > new Date();
  return Boolean(this.isVip);
};

export default mongoose.model("User", userSchema);
