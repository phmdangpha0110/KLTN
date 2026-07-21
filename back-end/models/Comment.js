import mongoose from "mongoose";
import { softDeletePlugin } from "../utils/softDeletePlugin.js";

const commentSchema = new mongoose.Schema({
  novelId: { type: mongoose.Schema.Types.ObjectId, ref: "Novel", index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  userName: String,
  userAvatar: String,
  isAnonymous: { type: Boolean, default: false },
  content: String,
  isDelete: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now }
});

commentSchema.plugin(softDeletePlugin);

export default mongoose.model("Comment", commentSchema);
