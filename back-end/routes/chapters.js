// back-end/routes/chapters.js
import { Router } from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { requireAuth, getUserId } from "../utils/auth.js";

import Chapter from "../models/Chapter.js";
import Novel from "../models/Novel.js";
import User from "../models/User.js";
import ChapterViewLog from "../models/ChapterViewLog.js";
import { notifyFavoriteUsers } from "../utils/notifyNewChapter.js";
import { expireVipIfNeeded, isVipActive } from "../utils/vipStatus.js";
import { checkBlacklist } from "../utils/checkBlacklist.js";
import Report from "../models/Report.js";
const router = Router();
const { Types } = mongoose;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const isDev = process.env.NODE_ENV !== "production";

/* ---------- helpers ---------- */
async function getUserFromAuthHeader(req) {
  try {
    const h = req.headers.authorization || "";
    if (!h.startsWith("Bearer ")) return null;

    const token = h.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET);

    const u = await User.findById(payload.id);
    await expireVipIfNeeded(u);

    return u || null;
  } catch {
    return null;
  }
}
function isVipNow(userDoc) {
  return isVipActive(userDoc);
}
function toObjectIdMaybe(id) {
  return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : id;
}
function getMonthKey() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}
router.get("/latest-updates", async (req, res) => {
  try {
    const items = await Chapter.find({})
      .sort({ createdAt: -1, no: -1 })
      .limit(10)
      .populate("novelId", "title genre")
      .lean();

    res.json({
      items: items.map((ch) => ({
        id: ch._id?.toString(),
        novelId:
          typeof ch.novelId === "object"
            ? ch.novelId?._id?.toString()
            : ch.novelId,
        novelTitle:
          typeof ch.novelId === "object"
            ? ch.novelId?.title || ""
            : "",
        genre:
          typeof ch.novelId === "object"
            ? ch.novelId?.genre || "Khác"
            : "Khác",
        chapterNo: ch.no,
        chapterTitle: ch.title,
        updatedAt: ch.createdAt,
      })),
    });
  } catch (e) {
    console.error("GET /api/chapters/latest-updates error:", e);
    res.status(500).json({ message: "Server error" });
  }
});
/* ---------- GET /api/chapters?novelId=... ---------- */
router.get("/", async (req, res) => {
  try {
    const { novelId } = req.query;
    const where = {};
    if (novelId) where.novelId = toObjectIdMaybe(novelId);

    if (isDev) console.log("[GET /chapters] where =", where);

    const items = await Chapter.find(where).sort({ no: 1 }).lean();

    // Chỉ khóa các chương tác giả bật kiếm tiền
    const user = await getUserFromAuthHeader(req);
    const vip = isVipNow(user);

    items.forEach((c) => {
      c.locked = Boolean(c.isPaid) && !vip;
    });

    res.json(items);
  } catch (e) {
    console.error("GET /chapters error:", e);
    res.status(500).json({ message: "Server error" });
  }
});


/* ---------- GET /api/chapters/one?novelId=...&no=... ---------- */
router.get("/one", async (req, res) => {
  try {
    const { novelId, no } = req.query;

    if (!novelId || no == null) {
      return res.status(400).json({ message: "novelId & no are required" });
    }

    const where = {
      novelId: toObjectIdMaybe(novelId),
      no: Number(no),
    };

    if (isDev) console.log("[GET /chapters/one] where =", where);

    const ch = await Chapter.findOne(where).lean();

    if (!ch) {
      return res.status(404).json({ message: "Chapter not found" });
    }

    const user = await getUserFromAuthHeader(req);
    const vip = isVipNow(user);

    if (ch.isPaid && !vip) {
      return res.status(403).json({
        code: "VIP_REQUIRED",
        message: "Chương này chỉ dành cho tài khoản VIP.",
      });
    }

    Novel.updateOne(
      { _id: toObjectIdMaybe(novelId) },
      { $inc: { views: 1 } }
    ).catch((err) => {
      console.error("[increase novel views] error:", err);
    });

    Chapter.updateOne(
      { _id: ch._id },
      {
        $inc: {
          views: 1,
          paidViews: ch.isPaid && vip ? 1 : 0,
        },
      }
    ).catch((err) => {
      console.error("[increase chapter views] error:", err);
    });

    if (ch.isPaid && vip) {
      Novel.findById(novelId)
        .select("authorId")
        .lean()
        .then((novel) => {
          if (!novel?.authorId) return;

          return ChapterViewLog.create({
            userId: user?._id || null,
            novelId: toObjectIdMaybe(novelId),
            chapterId: ch._id,
            authorId: novel.authorId,
            isPaid: true,
            month: getMonthKey(),
          });
        })
        .catch((err) => {
          console.error("[create chapter view log] error:", err);
        });
    }

    return res.json(ch);
  } catch (e) {
    console.error("GET /chapters/one error:", e);

    if (!res.headersSent) {
      return res.status(500).json({ message: "Server error" });
    }
  }
});

// POST /api/chapters  (chỉ tác giả của novel được thêm)
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.userId || getUserId(req);
    const currentUser = await User.findById(userId)
      .select("postBanUntil postBanReason status")
      .lean();

    if (!currentUser) {
      return res.status(401).json({ message: "Không tìm thấy người dùng." });
    }

    if (currentUser.status === "suspended") {
      return res.status(403).json({ message: "Tài khoản của bạn đang bị khóa." });
    }

    if (currentUser.postBanUntil && new Date(currentUser.postBanUntil) > new Date()) {
      return res.status(403).json({
        message: `Bạn đang bị cấm đăng bài đến ${new Date(currentUser.postBanUntil).toLocaleString("vi-VN")}.`,
        postBanUntil: currentUser.postBanUntil,
        reason: currentUser.postBanReason || "",
      });
    }
    const { novelId, no, title, content, isPaid } = req.body || {};
    if (!novelId || !no || !title) return res.status(400).json({ message: "Thiếu trường bắt buộc" });

    const novel = await Novel.findById(novelId);
    if (!novel) return res.status(404).json({ message: "Novel not found" });
    if (String(novel.authorId) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const blacklist = checkBlacklist(`${title || ""}\n${content || ""}`);

    const ch = await Chapter.create({
          novelId,
          no: Number(no),
          title,
          content: content || "",
          isPaid: Boolean(isPaid),
        });
        if (blacklist.flagged) {
          await Report.create({
            source: "ai",
            type: "chapter",
            novelId,
            chapterNo: Number(no),
            userId: userId || null,
            reason: "Hệ thống tự động phát hiện từ ngữ nhạy cảm",
            description: `Từ khóa phát hiện: ${blacklist.words.join(", ")}`,
            status: "pending",
          });
        }
  
    res.json(ch);
    notifyFavoriteUsers({ novelId, novelTitle: novel.title, chapterNo: Number(no), chapterTitle: title });
  } catch (e) {
    console.error("POST /chapters", e);
    res.status(500).json({ message: "Server error" });
  }
});
// GET /api/chapters/:id
// Lấy chi tiết chương để tác giả chỉnh sửa
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.userId || getUserId(req);
    const { id } = req.params;

    const chapter = await Chapter.findById(id).lean();
    if (!chapter) {
      return res.status(404).json({ message: "Không tìm thấy chương." });
    }

    const novel = await Novel.findById(chapter.novelId).lean();
    if (!novel) {
      return res.status(404).json({ message: "Không tìm thấy tác phẩm." });
    }

    if (String(novel.authorId) !== String(userId)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem/chỉnh sửa chương này.",
      });
    }

    res.json(chapter);
  } catch (e) {
    console.error("GET /api/chapters/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/chapters/:id
// Chỉ chính tác giả được sửa chương thuộc tác phẩm của mình
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.userId || getUserId(req);
    const { id } = req.params;

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return res.status(404).json({ message: "Không tìm thấy chương." });
    }

    const novel = await Novel.findById(chapter.novelId);
    if (!novel) {
      return res.status(404).json({ message: "Không tìm thấy tác phẩm." });
    }

    if (String(novel.authorId) !== String(userId)) {
      return res.status(403).json({
        message: "Bạn không có quyền sửa chương này.",
      });
    }

    const { no, title, content, isPaid } = req.body || {};

    if (no != null) chapter.no = Number(no);
    if (title != null) chapter.title = title;
    if (content != null) chapter.content = content;
    if (isPaid != null) chapter.isPaid = Boolean(isPaid);

    await chapter.save();

    res.json(chapter);
  } catch (e) {
    console.error("PUT /api/chapters/:id error:", e);

    if (e?.code === 11000) {
      return res.status(400).json({
        message: "Số chương này đã tồn tại trong tác phẩm.",
      });
    }

    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/chapters/:id
// Chỉ chính tác giả được xóa chương thuộc tác phẩm của mình
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.userId || getUserId(req);
    const { id } = req.params;

    const chapter = await Chapter.findById(id);
    if (!chapter) {
      return res.status(404).json({ message: "Không tìm thấy chương." });
    }

    const novel = await Novel.findById(chapter.novelId);
    if (!novel) {
      return res.status(404).json({ message: "Không tìm thấy tác phẩm." });
    }

    if (String(novel.authorId) !== String(userId)) {
      return res.status(403).json({
        message: "Bạn không có quyền xóa chương này.",
      });
    }

    await Chapter.updateOne(
      { _id: chapter._id },
      { $set: { isDelete: true } }
    );

    // Đồng bộ chaptersCount theo chapter còn hoạt động.
    const last = await Chapter.findOne({ novelId: novel._id }).sort({ no: -1 });
    await Novel.updateOne(
      { _id: novel._id },
      { $set: { chaptersCount: last ? last.no : 0 } }
    );

    res.json({ ok: true, message: "Đã xóa chương." });
  } catch (e) {
    console.error("DELETE /api/chapters/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
