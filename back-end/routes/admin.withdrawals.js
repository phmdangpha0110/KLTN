import { Router } from "express";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import AuthorMonthlyRevenue from "../models/AuthorMonthlyRevenue.js";
import { requireAdmin } from "../utils/requireAdmin.js";
import Notification from "../models/Notification.js";

const router = Router();

function toMoneyNumber(value) {
  return Math.max(0, Math.floor(Number(value || 0)));
}

async function getAuthorWalletBalance(authorId) {
  const revenueRows = await AuthorMonthlyRevenue.find({ authorId }).lean();

  const totalAuthorRevenue = revenueRows.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );

  const withdrawals = await WithdrawalRequest.find({ authorId }).lean();

  const lockedOrPaidAmount = withdrawals
    .filter((w) => ["pending", "approved", "paid"].includes(w.status))
    .reduce((sum, w) => sum + Number(w.amount || 0), 0);

  return toMoneyNumber(totalAuthorRevenue - lockedOrPaidAmount);
}

// GET /api/admin/withdrawals
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { status = "" } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const items = await WithdrawalRequest.find(filter)
      .populate("authorId", "name email avatar")
      .populate("processedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const itemsWithWallet = await Promise.all(
      items.map(async (item) => {
        const authorId = item.authorId?._id || item.authorId;
        const walletBalance = authorId
          ? await getAuthorWalletBalance(authorId)
          : 0;

        return {
          ...item,
          walletBalance,
        };
      })
    );

    res.json({ items: itemsWithWallet });
  } catch (err) {
    console.error("GET /api/admin/withdrawals error:", err);
    res.status(500).json({ message: "Không thể tải yêu cầu rút tiền." });
  }
});

// PUT /api/admin/withdrawals/:id/approve
router.put("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const item = await WithdrawalRequest.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu." });
    }

    if (item.status !== "pending") {
      return res.status(400).json({
        message: "Chỉ có thể duyệt yêu cầu đang chờ xử lý.",
      });
    }

    item.status = "approved";
    item.adminNote = req.body?.adminNote || "";
    item.processedBy = req.userId;
    item.processedAt = new Date();

    await item.save();

    res.json({
      ok: true,
      message: "Đã duyệt yêu cầu rút tiền.",
      item,
    });
  } catch (err) {
    console.error("PUT /api/admin/withdrawals/:id/approve error:", err);
    res.status(500).json({ message: "Không thể duyệt yêu cầu." });
  }
});

// PUT /api/admin/withdrawals/:id/reject
router.put("/:id/reject", requireAdmin, async (req, res) => {
  try {
    const item = await WithdrawalRequest.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu." });
    }

    if (!["pending", "approved"].includes(item.status)) {
      return res.status(400).json({
        message: "Không thể từ chối yêu cầu ở trạng thái hiện tại.",
      });
    }

    item.status = "rejected";
    item.adminNote = req.body?.adminNote || "";
    item.processedBy = req.userId;
    item.processedAt = new Date();

    await item.save();

    res.json({
      ok: true,
      message: "Đã từ chối yêu cầu rút tiền.",
      item,
    });
  } catch (err) {
    console.error("PUT /api/admin/withdrawals/:id/reject error:", err);
    res.status(500).json({ message: "Không thể từ chối yêu cầu." });
  }
});

// PUT /api/admin/withdrawals/:id/paid
router.put("/:id/paid", requireAdmin, async (req, res) => {
  try {
    const item = await WithdrawalRequest.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu." });
    }

    if (!["pending", "approved"].includes(item.status)) {
      return res.status(400).json({
        message:
          "Chỉ có thể đánh dấu đã thanh toán với yêu cầu đang chờ hoặc đã duyệt.",
      });
    }

    item.status = "paid";
    item.adminNote = req.body?.adminNote || item.adminNote || "";
    item.processedBy = req.userId;
    item.processedAt = item.processedAt || new Date();
    item.paidAt = new Date();

    await item.save();

    await Notification.create({
      userId: item.authorId,
      title: "Thanh toán doanh thu thành công",
      content: `Yêu cầu rút tiền ${Number(item.amount || 0).toLocaleString(
        "vi-VN"
      )}đ của bạn đã được admin xác nhận thanh toán.`,
      type: "revenue",
      link: "/studio/wallet",
    });

    res.json({
      ok: true,
      message: "Đã đánh dấu yêu cầu là đã thanh toán.",
      item,
    });
  } catch (err) {
    console.error("PUT /api/admin/withdrawals/:id/paid error:", err);
    res.status(500).json({ message: "Không thể cập nhật thanh toán." });
  }
});

export default router;