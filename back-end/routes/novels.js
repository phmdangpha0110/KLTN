import { Router } from "express";
import mongoose from "mongoose";
import Novel from "../models/Novel.js";
import User from "../models/User.js";
import { requireAuth, getUserId } from "../utils/auth.js";
import Chapter from "../models/Chapter.js";
import { checkCoverByUrl } from "../utils/moderationAI.js";
import { checkBlacklist } from "../utils/checkBlacklist.js";
import Report from "../models/Report.js";

const router = Router();
const { Types } = mongoose;

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 🔹 GET /api/novels
 *   - Trả danh sách truyện (lọc theo genre, q, limit)
 */
router.get("/", async (req, res) => {
  try {
    const { genre, q, limit, authorId } = req.query;
    const where = {};

    // Lọc theo thể loại
    if (genre) where.genre = genre;
    // Lọc theo tác giả (nếu có)
    if (authorId) {
      if (Types.ObjectId.isValid(authorId)) {
        where.authorId = new Types.ObjectId(authorId);
      } else {
        // Dự phòng nếu dữ liệu authorId được lưu dạng string
        where.authorId = authorId;
      }
    }


    // Tìm kiếm
    if (q && q.trim()) {
      const rx = new RegExp(escapeRegex(q.trim()), "i");
      where.$or = [
        { title: rx },
        { authorName: rx },
        { description: rx },
        { genre: rx },
      ];
    }

    // Giới hạn số lượng
    const lim = limit ? Number(limit) : 0;

    const rows = await Novel.find(where)
      .sort({ createdAt: -1 })
      .limit(lim)
      .lean();
    // Bổ sung authorName từ User nếu thiếu
    const needAuthorName = rows.filter((n) => !n.authorName && n.authorId);
    let authorMap = new Map();
    if (needAuthorName.length) {
      const ids = Array.from(
        new Set(
          needAuthorName
            .map((n) => n.authorId)
            .filter((id) => Types.ObjectId.isValid(String(id)))
            .map((id) => new Types.ObjectId(id))
        )
      );
      if (ids.length) {
        const authors = await User.find({ _id: { $in: ids } })
          .select("name")
          .lean();
        authorMap = new Map(authors.map((a) => [String(a._id), a.name]));
      }
    }

    // Chuẩn hoá cho frontend
    const mapped = rows.map((n) => ({
      ...n,
      authorName: n.authorName || authorMap.get(String(n.authorId)) || n.author,
      author: n.author || n.authorName || authorMap.get(String(n.authorId)),
      id: n._id?.toString(),
    }));

    res.json(mapped);
  } catch (e) {
    console.error("GET /api/novels error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * 🔹 GET /api/novels/:id
 *   - Trả về chi tiết 1 truyện
 */
router.get("/ranking/top-read", async (req, res) => {
  try {
    const items = await Novel.find({})
      .sort({ views: -1, createdAt: -1 })
      .limit(10)
      .select("title cover authorName author genre chaptersCount views createdAt")
      .lean();

    res.json({
      items: items.map((n) => ({
        ...n,
        id: n._id?.toString(),
        views: n.views || 0,
        chaptersCount: n.chaptersCount || 0,
        author: n.author || n.authorName || "",
      })),
    });
  } catch (e) {
    console.error("GET /api/novels/ranking/top-read error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/ranking/latest", async (req, res) => {
  try {
    const items = await Novel.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select("title cover authorName author genre chaptersCount views createdAt")
      .lean();

    res.json({
      items: items.map((n) => ({
        ...n,
        id: n._id?.toString(),
        views: n.views || 0,
        chaptersCount: n.chaptersCount || 0,
        author: n.author || n.authorName || "",
      })),
    });
  } catch (e) {
    console.error("GET /api/novels/ranking/latest error:", e);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    let novel = null;

    // Nếu id hợp lệ ObjectId -> tìm theo _id
    if (mongoose.Types.ObjectId.isValid(id)) {
      novel = await Novel.findById(id).lean();
    }

    // Nếu không tìm được hoặc id không phải ObjectId, thử theo id custom
    if (!novel) {
      novel = await Novel.findOne({ id }).lean();
    }

    if (!novel) {
      return res.status(404).json({ message: "Novel not found" });
    }
    // Bổ sung authorName nếu chưa có
    if (!novel.authorName && novel.authorId && Types.ObjectId.isValid(String(novel.authorId))) {
      const author = await User.findById(novel.authorId).select("name").lean();
      if (author) {
        novel.authorName = author.name;
      }
    }
    // Chuẩn hoá cho frontend
    novel.id = novel._id?.toString() || novel.id;
    novel.author = novel.author || novel.authorName;

    res.json(novel);
  } catch (e) {
    console.error("GET /api/novels/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/novels  (chỉ tác giả đã đăng nhập)
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.userId || getUserId(req); // dự phòng
    const currentUser = await User.findById(userId)
      .select("name postBanUntil postBanReason status")
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
    const { title, description, genre, cover, status } = req.body || {};

    if (!title) {
      return res.status(400).json({ message: "Thiếu tiêu đề" });
    }
    
    let moderationStatus = "approved";
    let moderationLabel = "safe";
    let moderationSafeScore = 1;
    let moderationUnsafeScore = 0;
    let moderationNote = "Không có ảnh bìa hoặc ảnh bìa được xem là an toàn.";
    
    if (cover) {
    
      const aiResult = await checkCoverByUrl(cover);
  
      moderationSafeScore = Number(aiResult.safe_score ?? 0);
      moderationUnsafeScore = Number(aiResult.unsafe_score ?? 0);
      const safePercent = Math.round(moderationSafeScore * 100);
      const unsafePercent = Math.round(moderationUnsafeScore * 100);
    
      if (moderationUnsafeScore >= 0.5 && moderationUnsafeScore <= 0.6) {
        return res.status(400).json({
          message:
            `Ảnh bìa chưa đủ chắc chắn để đăng. Vui lòng chọn ảnh khác rõ ràng và phù hợp hơn.`,
          moderation: {
            label: "uncertain",
            safe_score: moderationSafeScore,
            unsafe_score: moderationUnsafeScore,
            safe_percent: safePercent,
            unsafe_percent: unsafePercent,
          },
        });
      }
    
      if (moderationUnsafeScore > 0.6) {
        return res.status(400).json({
          message:
            `/nẢnh bìa có dấu hiệu không phù hợp. Vui lòng chọn ảnh khác.`,
          moderation: {
            label: "unsafe",
            safe_score: moderationSafeScore,
            unsafe_score: moderationUnsafeScore,
            safe_percent: safePercent,
            unsafe_percent: unsafePercent,
          },
        });
      }
    
      moderationStatus = "approved";
      moderationLabel = "safe";
      moderationNote = aiResult.skipped
        ? aiResult.message || "Đã bỏ qua kiểm duyệt ảnh bìa."
        : `Ảnh bìa đã được AI đánh giá an toàn. Safe: ${safePercent}%, Unsafe: ${unsafePercent}%.`;
    }
    const blacklist = checkBlacklist(`${title || ""}\n${description || ""}`);

    const doc = await Novel.create({
      title,
      description: description || "",
      genre: genre || "",
      cover: cover || "",
      authorId: userId,
      authorName: currentUser?.name || "",
      status: status === "completed" ? "completed" : "ongoing",
    
      moderationStatus,
      moderationLabel,
      moderationSafeScore,
      moderationUnsafeScore,
      moderationNote,
    });
    if (blacklist.flagged) {
      await Report.create({
        source: "ai",
        type: "novel",
        novelId: doc._id,
        userId: userId || null,
        reason: "Hệ thống tự động phát hiện từ ngữ nhạy cảm",
        description: `Từ khóa phát hiện: ${blacklist.words.join(", ")}`,
        status: "pending",
      });
    }
    res.json(doc);
  } catch (e) {
    console.error("POST /novels error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/novels/:id  (chỉ chính tác giả được sửa)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.userId || getUserId(req);
    const id = req.params.id;

    const novel = await Novel.findById(id);
    if (!novel) return res.status(404).json({ message: "Novel not found" });
    if (String(novel.authorId) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { title, description, genre, cover, status } = req.body || {};
    if (title != null) novel.title = title;
    if (description != null) novel.description = description;
    if (genre != null) novel.genre = genre;
    if (cover != null) novel.cover = cover;
    if (status !== undefined) {
      novel.status = status === "completed" ? "completed" : "ongoing";
    }

    await novel.save();
    res.json(novel);
  } catch (e) {
    console.error("PUT /novels/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});
// DELETE /api/novels/:id
// Chỉ chính tác giả được xóa tác phẩm của mình
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.userId || getUserId(req);
    const { id } = req.params;

    const novel = await Novel.findById(id);
    if (!novel) {
      return res.status(404).json({ message: "Không tìm thấy tác phẩm." });
    }

    if (String(novel.authorId) !== String(userId)) {
      return res.status(403).json({
        message: "Bạn không có quyền xóa tác phẩm này.",
      });
    }

    await Promise.all([
      Novel.updateOne(
        { _id: novel._id },
        { $set: { isDelete: true } }
      ),
      Chapter.updateMany(
        { novelId: novel._id },
        { $set: { isDelete: true } }
      ),
    ]);

    res.json({ ok: true, message: "Đã xóa tác phẩm." });
  } catch (e) {
    console.error("DELETE /api/novels/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});
export default router;
