// back-end/models/Chapter.js
import mongoose from "mongoose";
import { softDeletePlugin } from "../utils/softDeletePlugin.js";

const chapterSchema = new mongoose.Schema(
  {
    novelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Novel",
      index: true,
    },

    no: {
      type: Number,
      index: true,
    },

    title: String,
    content: String,

    isDelete: { type: Boolean, default: false, index: true },

    // Tổng lượt đọc chương
    views: {
      type: Number,
      default: 0,
    },

    // Chương có bật kiếm tiền / VIP hay không
    isPaid: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Lượt đọc hợp lệ để chia doanh thu
    paidViews: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

chapterSchema.plugin(softDeletePlugin);

// Chỉ bắt unique số chương với bản ghi đang hoạt động.
// Bản ghi isDelete=true được giữ lại nhưng không chặn tạo lại cùng số chương.
chapterSchema.index(
  { novelId: 1, no: 1 },
  {
    unique: true,
    name: "novelId_1_no_1_active",
    partialFilterExpression: { isDelete: false },
  }
);

export default mongoose.model("Chapter", chapterSchema);