// back-end/routes/payments.sandbox.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import VipCode from "../models/VipCode.js";
import VipOrder from "../models/VipOrder.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// 💰 Giá sandbox (hiển thị cho user, không giao dịch thật)
const PRICE_MAP = {
  DAY: 5000,     // 1 ngày = 5.000đ
  MONTH: 99000,  // 1 tháng = 99.000đ
};

// Lấy userId từ Bearer token (fallback: ?userId=... cho dev)
function getUserId(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) {
    try {
      const token = h.split(" ")[1];
      const payload = jwt.verify(token, JWT_SECRET);
      return payload.id;
    } catch {}
  }
  // CHỈ dev/sandbox
  if (req.query.userId) return req.query.userId;
  return null;
}

// Cộng thêm số ngày VIP vào vipUntil hiện tại
function addVipDays(currentVipUntil, days) {
  const now = new Date();
  const base =
    currentVipUntil && new Date(currentVipUntil) > now
      ? new Date(currentVipUntil)
      : now;
  base.setDate(base.getDate() + days);
  return base;
}

// Chuẩn hoá plan từ client -> { days, price, label, code }
function normalizePlan(planRaw) {
  if (!planRaw) return null;
  const p = String(planRaw).toLowerCase();

  // hỗ trợ cả tên cũ ("vip1d", "vip1m") lẫn tên mới ("day", "month")
  if (p === "vip1d" || p === "day") {
    return { days: 1, price: PRICE_MAP.DAY, code: "DAY", label: "VIP 1 ngày" };
  }
  if (p === "vip1m" || p === "month") {
    return { days: 30, price: PRICE_MAP.MONTH, code: "MONTH", label: "VIP 1 tháng" };
  }
  return null;
}

// Tạo mã random
function generateRandomCode(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/**
 * 🎰 VÒNG QUAY MAY MẮN – sau khi xem quảng cáo
 * Mount: POST /api/payments/sandbox/spin
 */
router.post("/spin", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Thiếu token hoặc userId" });
    }

    // TODO: bạn có thể giới hạn số lần quay/ngày tại đây

    const prizes = [
      { type: "VIP_1_DAY", label: "VIP 1 ngày", weight: 60 },
      { type: "VIP_30_DAYS", label: "VIP 1 tháng", weight: 5 },
      { type: "NONE", label: "Không trúng thưởng", weight: 35 },
    ];

    const totalWeight = prizes.reduce((s, p) => s + p.weight, 0);
    let rand = Math.random() * totalWeight;
    let selected = prizes[0];
    for (const p of prizes) {
      if (rand < p.weight) {
        selected = p;
        break;
      }
      rand -= p.weight;
    }

    let vipCodeDoc = null;

    if (selected.type === "VIP_1_DAY" || selected.type === "VIP_30_DAYS") {
      const days = selected.type === "VIP_1_DAY" ? 1 : 30;
      const code = generateRandomCode(10);

      vipCodeDoc = await VipCode.create({
        code,
        type: days === 1 ? "DAY" : "MONTH",
        days,
        status: "NEW",
        source: "WHEEL",
        owner: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // code có hạn 7 ngày
      });
    }

    return res.json({
      prizeType: selected.type,
      prizeLabel: selected.label,
      vipCode: vipCodeDoc ? vipCodeDoc.code : null,
      days: vipCodeDoc ? vipCodeDoc.days : 0,
    });
  } catch (err) {
    console.error("POST /payments/sandbox/spin error:", err);
    res.status(500).json({ message: "Lỗi vòng quay" });
  }
});

/**
 * 💳 REDEEM MÃ VIP
 * Mount: POST /api/payments/sandbox/redeem
 * body: { code }
 */
router.post("/redeem", async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return res.status(400).json({ message: "Vui lòng nhập mã code" });
    }

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Thiếu token hoặc userId" });
    }

    const doc = await VipCode.findOne({ code: code.trim().toUpperCase() });

    if (!doc) {
      return res.status(404).json({ message: "Mã không tồn tại" });
    }

    if (doc.status !== "NEW") {
      return res.status(400).json({ message: "Mã đã được sử dụng hoặc không hợp lệ" });
    }

    if (doc.expiresAt && doc.expiresAt < new Date()) {
      doc.status = "EXPIRED";
      await doc.save();
      return res.status(400).json({ message: "Mã đã hết hạn" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User không tồn tại" });

    const newVipUntil = addVipDays(user.vipUntil, doc.days);
    user.isVip = true;
    user.vipUntil = newVipUntil;
    await user.save();

    doc.status = "USED";
    doc.usedBy = userId;
    doc.usedAt = new Date();
    await doc.save();

    return res.json({
      ok: true,
      message: "Nâng cấp VIP thành công",
      isVip: true,
      vipUntil: user.vipUntil,
      days: doc.days,
    });
  } catch (err) {
    console.error("POST /payments/sandbox/redeem error:", err);
    res.status(500).json({ message: "Lỗi đổi mã VIP" });
  }
});

/**
 * 🛒 MUA VIP TRỰC TIẾP (SANDBOX)
 * Mount: POST /api/payments/sandbox/buy
 * body: { plan: "vip1d" | "vip1m" | "day" | "month" }
 */
async function handleBuyVip(req, res) {
  try {
    const { plan } = req.body || {};
    const normalized = normalizePlan(plan);

    if (!normalized) {
      return res.status(400).json({ message: "Gói không hợp lệ" });
    }

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Thiếu token hoặc userId" });
    }

    const user = await User.findById(userId).select("_id name email");
    if (!user) {
      return res.status(404).json({ message: "User không tồn tại" });
    }

    const planCode = normalized.code === "DAY" ? "1d" : "1m";
    const shortCode = Math.floor(100000 + Math.random() * 900000);
    const orderId = `VIP${shortCode}`;
    const content = orderId;

    const order = await VipOrder.create({
      userId: user._id,
      plan: planCode,
      amount: normalized.price,
      content,
      orderId,
      status: "pending",
    });

    return res.json({
      ok: true,
      status: "pending",
      message: "Đã tạo đơn thanh toán. Vui lòng chuyển khoản đúng số tiền và nội dung.",
      order: {
        id: order._id,
        orderId: order.orderId,
        plan: order.plan,
        amount: order.amount,
        content: order.content,
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    console.error("POST /payments/sandbox/buy error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// Endpoint chuẩn mới: /api/payments/sandbox/buy
router.post("/buy", handleBuyVip);

// Endpoint cũ: /api/payments/sandbox/pay -> alias sang buy (giữ tương thích)
router.post("/pay", handleBuyVip);

/**
 * GET /api/payments/sandbox/status/:orderId
 * -> luôn trả paid (sandbox)
 * Mount: GET /api/payments/sandbox/status/:orderId
 */
router.get("/status/:orderId", async (req, res) => {
  try {
    const order = await VipOrder.findOne({ orderId: req.params.orderId }).lean();

    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn thanh toán" });
    }

    return res.json({
      ok: true,
      status: order.status,
      order,
    });
  } catch (err) {
    console.error("GET /payments/sandbox/status/:orderId error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * ⚙️ DEV-ONLY: tạo mã test
 * Mount: POST /api/payments/sandbox/dev/generate-code
 * body: { days: number }
 */
router.post("/dev/generate-code", async (req, res) => {
  try {
    const { days = 1 } = req.body || {};
    const code = generateRandomCode(10);
    const doc = await VipCode.create({
      code,
      type: days >= 30 ? "MONTH" : "DAY",
      days,
      source: "SANDBOX",
      status: "NEW",
    });
    return res.json(doc);
  } catch (err) {
    console.error("POST /payments/sandbox/dev/generate-code error:", err);
    res.status(500).json({ message: "Lỗi tạo mã test" });
  }
});

export default router;
