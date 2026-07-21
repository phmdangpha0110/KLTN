import { Router } from "express";
import Comment from "../models/Comment.js";
import Report from "../models/Report.js";
import { checkBlacklist } from "../utils/checkBlacklist.js";

const r = Router();

// GET /api/comments?novelId=...
r.get("/", async (req, res) => {
  const { novelId } = req.query;
  const list = await Comment.find({ novelId }).sort({ createdAt: -1 });
  res.json(list);
});

// POST /api/comments
r.post("/", async (req, res) => {
  try {
    const { novelId, userId, userName, userAvatar, content, isAnonymous } =
      req.body;

    if (!novelId || !content) {
      return res.status(400).json({ message: "Missing novelId/content" });
    }

    const blacklist = checkBlacklist(content);

    // Vẫn lưu bình luận bình thường
    const c = await Comment.create({
      novelId,
      userId,
      userName,
      userAvatar,
      isAnonymous: Boolean(isAnonymous),
      content,
    });

    // Nếu có từ nhạy cảm thì tạo report tự động cho admin
    if (blacklist.flagged) {
      await Report.create({
        source: "ai",
        type: "comment",
        novelId,
        commentId: c._id,
        userId: userId || null,
        reason: "Hệ thống tự động phát hiện từ ngữ nhạy cảm",
        description: `Từ khóa phát hiện: ${blacklist.words.join(", ")}`,
        status: "pending",
      });
    }

    res.status(201).json(c);
  } catch (err) {
    console.error("POST /api/comments error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default r;