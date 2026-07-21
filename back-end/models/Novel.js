import mongoose from "mongoose";
import { softDeletePlugin } from "../utils/softDeletePlugin.js";

const novelSchema = new mongoose.Schema({
  title: { type: String, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "Author" },
  authorName: String,
  genre: { type: String, index: true },
  cover: String,
  description: String,
  chaptersCount: { type: Number, default: 0 },
  views: { type: Number, default: 0, index: true },
  createdAt: { type: Date, default: Date.now },
  isDelete: { type: Boolean, default: false, index: true },
  status: {
    type: String,
    enum: ["ongoing", "completed"],
    default: "ongoing",
  },

  moderationStatus: {
    type: String,
    enum: ["approved", "blocked", "uncertain"],
    default: "approved",
  },
  
  moderationLabel: {
    type: String,
    enum: ["safe", "unsafe", "uncertain"],
    default: "safe",
  },
  
  moderationSafeScore: {
    type: Number,
    default: 1,
  },
  
  moderationUnsafeScore: {
    type: Number,
    default: 0,
  },
  
  moderationNote: {
    type: String,
    default: "",
  },
  
});

novelSchema.plugin(softDeletePlugin);

export default mongoose.model("Novel", novelSchema);
