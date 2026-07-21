// back-end/routes/admin.reports.js
import { Router } from "express";
import Report from "../models/Report.js";
import Novel from "../models/Novel.js";
import Chapter from "../models/Chapter.js";
import User from "../models/User.js";
import Author from "../models/Author.js";
import Notification from "../models/Notification.js";
import Comment from "../models/Comment.js";
import { requireAdmin } from "../utils/requireAdmin.js";

const router = Router();

/**
 * Helper: Tìm user vi phạm (target user) từ 1 report
 * - type = "novel" | "chapter" => Novel.authorId -> Author.userId (tuỳ schema Author)
 * - type = "other" => không suy ra được user vi phạm => null
 */
async function findTargetUserId(report) {
  try {
    if ((report.type === "novel" || report.type === "chapter") && report.novelId) {
      const novel = await Novel.findById(report.novelId).select("authorId").lean();
      if (!novel?.authorId) return null;

      const maybeUser = await User.findById(novel.authorId).select("_id").lean();
      if (maybeUser?._id) return maybeUser._id;

      const author = await Author.findById(novel.authorId).select("userId").lean();
      return author?.userId || null;
    }

    if (report.type === "comment" && report.commentId) {
      const comment = await Comment.findById(report.commentId).select("userId").lean();
      return comment?.userId || null;
    }

    return null;
  } catch (err) {
    console.error("[findTargetUserId] error:", err);
    return null;
  }
}

/**
 * Helper: Gửi cảnh báo (tạo Notification theo schema bạn đưa)
 */
async function sendWarningNotification(userId, report) {
  if (!userId) return;

  try {
    const title = "Cảnh báo vi phạm nội quy";

    const summaryType =
      report.type === "novel"
        ? "tác phẩm"
        : report.type === "chapter"
        ? "chương truyện"
        : "nội dung";

    const contentLines = [
      `Tài khoản của bạn đã bị báo cáo do nghi ngờ vi phạm ở ${summaryType}.`,
      report.reason ? `Lý do: ${report.reason}` : null,
      report.description ? `Mô tả: ${report.description}` : null,
      "Vui lòng rà soát lại nội dung và tuân thủ quy định của hệ thống.",
    ].filter(Boolean);

    await Notification.create({
      userId,
      title,
      content: contentLines.join("\n"),
      type: "warning",
      link: report.novelId ? `/novel/${report.novelId}` : "",
      // createdAt mặc định, read mặc định false theo schema Notification
    });

    console.log(
      "[WARN_USER_NOTIFICATION] created for",
      userId.toString(),
      "reportId=",
      report._id.toString()
    );
  } catch (err) {
    console.error("[sendWarningNotification] error:", err);
  }
}
function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

async function notifyUser(userId, { title, content, type = "warning", link = "" }) {
  if (!userId) return;
  try {
    await Notification.create({ userId, title, content, type, link });
  } catch (err) {
    console.error("[notifyUser] error:", err);
  }
}

/**
 * GET /api/admin/reports
 * Query:
 *   - status?: "pending" | "reviewing" | "resolved" | "rejected"
 *   - type?: "novel" | "chapter" | "other"
 */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { status, type } = req.query;
    const cond = {};

    if (status) cond.status = status;
    if (type) cond.type = type;

    const list = await Report.find(cond).sort({ createdAt: -1 }).lean();
    return res.json({ items: list });
  } catch (err) {
    console.error("[GET /api/admin/reports] error:", err);
    return res.status(500).json({ message: "Không thể tải danh sách báo cáo." });
  }
});

/**
 * GET /api/admin/reports/:id
 */
router.get("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const report = await Report.findById(id)
      .populate("novelId")
      .populate("userId")      // user báo cáo (nếu có)
      .populate("reviewedBy")
      .lean();

    if (!report) {
      return res.status(404).json({ message: "Không tìm thấy báo cáo." });
    }

    return res.json({ report });
  } catch (err) {
    console.error("[GET /api/admin/reports/:id] error:", err);
    return res.status(500).json({ message: "Không thể tải chi tiết báo cáo." });
  }
});

/**
 * POST /api/admin/reports/:id/action
 * Body: { decision: "warn"|"deleteContent"|"deleteUser"|"reject", adminNote?: string }
 */
router.post("/:id/action", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, adminNote, editDeadline, banDays } = req.body || {};

    const allowed = [
      "requestEdit",
      "warn",          // giữ tương thích cũ
      "deleteContent",
      "banPosting",
      "deleteUser", 
      "markResolved",   // giữ tương thích cũ nhưng không khuyến nghị dùng
      "reject",
    ];

    if (!decision || !allowed.includes(decision)) {
      return res.status(400).json({ message: "Quyết định xử lý không hợp lệ." });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ message: "Không tìm thấy báo cáo." });
    }

    const targetUserId = await findTargetUserId(report);

    let status = "resolved";
    let lastAction = null;
    let finalEditDeadline = null;
    let finalBanDays = null;

    const note = (adminNote || "").trim();
    const reportLink = report.novelId ? `/novel/${report.novelId}` : "";

    if (decision === "requestEdit" || decision === "warn") {
      if (!targetUserId) {
        return res.status(400).json({
          message: "Không tìm được tác giả/người vi phạm để gửi yêu cầu chỉnh sửa.",
        });
      }

      status = "reviewing";
      lastAction = "request_edit";

      finalEditDeadline = editDeadline
        ? new Date(editDeadline)
        : addDays(3);

      await notifyUser(targetUserId, {
        title: "Yêu cầu chỉnh sửa nội dung vi phạm",
        type: "warning",
        link: reportLink,
        content: [
          "Nội dung của bạn đã bị báo cáo và cần được chỉnh sửa.",
          report.reason ? `Lý do: ${report.reason}` : null,
          note ? `Yêu cầu từ quản trị viên: ${note}` : null,
          `Hạn chỉnh sửa: ${finalEditDeadline.toLocaleString("vi-VN")}`,
          "Nếu quá hạn hoặc tiếp tục vi phạm, nội dung có thể bị xóa và tài khoản có thể bị cấm đăng bài.",
        ].filter(Boolean).join("\n"),
      });
    }

    else if (decision === "deleteContent") {
      lastAction = "delete";

      if (report.type === "novel" && report.novelId) {
        await Promise.all([
          Novel.updateOne(
            { _id: report.novelId },
            { $set: { isDelete: true } }
          ),
          Chapter.updateMany(
            { novelId: report.novelId },
            { $set: { isDelete: true } }
          ),
        ]);
      } else if (report.type === "chapter" && report.novelId && report.chapterNo != null) {
        await Chapter.updateOne(
          { novelId: report.novelId, no: report.chapterNo },
          { $set: { isDelete: true } }
        );

        const last = await Chapter.findOne({ novelId: report.novelId }).sort({ no: -1 });
        await Novel.updateOne(
          { _id: report.novelId },
          { $set: { chaptersCount: last ? last.no : 0 } }
        );
      } else if (report.type === "comment" && report.commentId) {
        await Comment.updateOne(
          { _id: report.commentId },
          { $set: { isDelete: true } }
        );
      } else {
        return res.status(400).json({
          message: "Báo cáo này không có nội dung cụ thể để xóa.",
        });
      }

      if (targetUserId) {
        await notifyUser(targetUserId, {
          title: "Nội dung vi phạm đã bị xóa",
          type: "warning",
          link: "",
          content: [
            "Một nội dung của bạn đã bị quản trị viên xóa do vi phạm quy định.",
            report.reason ? `Lý do: ${report.reason}` : null,
            note ? `Ghi chú từ quản trị viên: ${note}` : null,
          ].filter(Boolean).join("\n"),
        });
      }
    }

    else if (decision === "banPosting") {
      if (!targetUserId) {
        return res.status(400).json({
          message: "Không tìm được tác giả/người vi phạm để cấm đăng bài.",
        });
      }

      finalBanDays = Number(banDays || 7);
      if (![3, 7, 14, 30].includes(finalBanDays)) {
        return res.status(400).json({
          message: "Thời hạn cấm đăng không hợp lệ. Chỉ cho phép 3, 7, 14 hoặc 30 ngày.",
        });
      }

      const postBanUntil = addDays(finalBanDays);

      await User.updateOne(
        { _id: targetUserId },
        {
          postBanUntil,
          postBanReason: note || report.reason || "Vi phạm quy định đăng bài.",
        }
      );

      lastAction = "ban_posting";

      await notifyUser(targetUserId, {
        title: "Bạn đã bị cấm đăng bài tạm thời",
        type: "warning",
        link: "",
        content: [
          `Tài khoản của bạn bị cấm đăng truyện/chương trong ${finalBanDays} ngày.`,
          `Thời hạn đến: ${postBanUntil.toLocaleString("vi-VN")}`,
          report.reason ? `Lý do: ${report.reason}` : null,
          note ? `Ghi chú từ quản trị viên: ${note}` : null,
          "Trong thời gian này bạn vẫn có thể đăng nhập và sử dụng các chức năng khác.",
        ].filter(Boolean).join("\n"),
      });
    }

    else if (decision === "deleteUser") {
      if (!targetUserId) {
        return res.status(400).json({
          message: "Không tìm được tài khoản vi phạm để khoá.",
        });
      }

      await User.updateOne(
        { _id: targetUserId },
        { $set: { status: "suspended", isDelete: true } }
      );
      lastAction = "lock";
    }
    else if (decision === "markResolved") {
      status = "resolved";
      lastAction = null;
    
      if (targetUserId) {
        await notifyUser(targetUserId, {
          title: "Báo cáo đã được xử lý",
          type: "warning",
          link: reportLink,
          content: [
            "Quản trị viên đã xác nhận báo cáo này đã được xử lý.",
            note ? `Ghi chú: ${note}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        });
      }
    }
    
    else if (decision === "reject") {
      status = "rejected";
      lastAction = null;
    }

    report.status = status;
    report.lastAction = lastAction;
    report.adminNote = note;
    report.editDeadline = finalEditDeadline;
    report.banDays = finalBanDays;
    report.resolvedAt = status === "reviewing" ? null : new Date();

    if (req.userId) report.reviewedBy = req.userId;
    else if (req.user?._id) report.reviewedBy = req.user._id;

    await report.save();

    return res.json({ message: "Đã xử lý báo cáo.", report });
  } catch (err) {
    console.error("[POST /api/admin/reports/:id/action] error:", err);
    return res.status(500).json({ message: "Có lỗi xảy ra khi xử lý báo cáo." });
  }
});

export default router;
