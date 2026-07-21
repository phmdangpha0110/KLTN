import { Router } from "express";
import { requireAuth, getUserId } from "../utils/auth.js";
import AuthorMonthlyRevenue from "../models/AuthorMonthlyRevenue.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";

const router = Router();

function toMoney(value) {
  return Math.max(0, Math.floor(Number(value || 0)));
}

async function getWalletSummary(authorId) {
  const revenueRows = await AuthorMonthlyRevenue.find({ authorId }).lean();

  const totalAuthorRevenue = revenueRows.reduce(
    (sum, row) => sum + Number(row.amount || 0),
    0
  );

  const withdrawals = await WithdrawalRequest.find({ authorId }).lean();

  const pendingAmount = withdrawals
    .filter((w) => ["pending", "approved"].includes(w.status))
    .reduce((sum, w) => sum + Number(w.amount || 0), 0);

  const paidAmount = withdrawals
    .filter((w) => w.status === "paid")
    .reduce((sum, w) => sum + Number(w.amount || 0), 0);

  const rejectedAmount = withdrawals
    .filter((w) => w.status === "rejected")
    .reduce((sum, w) => sum + Number(w.amount || 0), 0);

  const availableBalance = Math.max(
    0,
    totalAuthorRevenue - pendingAmount - paidAmount
  );

  return {
    totalAuthorRevenue: toMoney(totalAuthorRevenue),
    availableBalance: toMoney(availableBalance),
    pendingAmount: toMoney(pendingAmount),
    paidAmount: toMoney(paidAmount),
    rejectedAmount: toMoney(rejectedAmount),
    platformRate: 50,
    authorRate: 50,
  };
}

// GET /api/author/wallet
router.get("/wallet", requireAuth, async (req, res) => {
  try {
    const authorId = req.userId || getUserId(req);
    const summary = await getWalletSummary(authorId);

    const monthlyRows = await AuthorMonthlyRevenue.find({ authorId })
      .sort({ month: -1 })
      .lean();

    res.json({
      summary,
      monthlyRows,
    });
  } catch (err) {
    console.error("GET /api/author/wallet error:", err);
    res.status(500).json({ message: "Không thể tải ví tác giả." });
  }
});

// GET /api/author/withdrawals
router.get("/withdrawals", requireAuth, async (req, res) => {
  try {
    const authorId = req.userId || getUserId(req);

    const items = await WithdrawalRequest.find({ authorId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ items });
  } catch (err) {
    console.error("GET /api/author/withdrawals error:", err);
    res.status(500).json({ message: "Không thể tải lịch sử rút tiền." });
  }
});

// POST /api/author/withdrawals
router.post("/withdrawals", requireAuth, async (req, res) => {
  try {
    const authorId = req.userId || getUserId(req);

    const { amount, bankName, bankAccount, bankHolder, note } = req.body || {};

    const money = Number(amount || 0);

    if (!money || money < 1000) {
      return res.status(400).json({
        message: "Số tiền rút tối thiểu là 1.000đ.",
      });
    }

    if (!bankName?.trim() || !bankAccount?.trim() || !bankHolder?.trim()) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ thông tin ngân hàng.",
      });
    }

    const summary = await getWalletSummary(authorId);

    if (money > summary.availableBalance) {
      return res.status(400).json({
        message: "Số dư khả dụng không đủ để tạo yêu cầu rút tiền.",
      });
    }

    const item = await WithdrawalRequest.create({
      authorId,
      amount: Math.floor(money),
      bankName: bankName.trim(),
      bankAccount: bankAccount.trim(),
      bankHolder: bankHolder.trim(),
      note: note?.trim() || "",
      status: "pending",
    });

    res.json({
      ok: true,
      message: "Đã gửi yêu cầu rút tiền. Vui lòng chờ admin xử lý.",
      item,
    });
  } catch (err) {
    console.error("POST /api/author/withdrawals error:", err);
    res.status(500).json({ message: "Không thể tạo yêu cầu rút tiền." });
  }
});

export default router;