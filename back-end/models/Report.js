// back-end/models/Report.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const attachmentSchema = new Schema(
  {
    name: String,
    url: String, // base64 dataURL hoặc link lưu trữ
  },
  { _id: false }
);

const reportSchema = new Schema(
  {
    type: { type: String, enum: ["chapter", "novel", "comment", "other"], required: true },
    novelId: { type: Schema.Types.ObjectId, ref: "Novel" },
    chapterNo: Number,
    commentId: { type: Schema.Types.ObjectId, ref: "Comment" },  // <<< thêm

    reason: String,
    description: String,

    attachments: [attachmentSchema],

    userId: { type: Schema.Types.ObjectId, ref: "User" }, // nếu muốn gắn user báo cáo
    source: {
      type: String,
      enum: ["user", "ai"],
      default: "user",
    },
    
    aiModeration: {
      flagged: { type: Boolean, default: false },
      flaggedCategories: [{ type: String }],
      categories: { type: Schema.Types.Mixed, default: {} },
      category_scores: { type: Schema.Types.Mixed, default: {} },
      error: { type: String, default: "" },
    },
    status: { type: String, enum: ["pending", "reviewing", "resolved", "rejected"], default: "pending" },
    lastAction: {
      type: String,
      enum: ["request_edit", "delete", "ban_posting", "lock", null],
      default: null,
    },
    adminNote: { type: String, default: "" },
    editDeadline: { type: Date, default: null },
    banDays: { type: Number, default: null },
    resolvedAt: { type: Date, default: null },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  
  { timestamps: true }
);

export default mongoose.model("Report", reportSchema);
