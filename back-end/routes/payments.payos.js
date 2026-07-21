// back-end/routes/payments.payos.js

import { Router } from "express";
import { PayOS } from "@payos/node";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import VipOrder from "../models/VipOrder.js";
import Notification from "../models/Notification.js";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// =========================
// PayOS
// =========================

let payosClient;

function getPayOSClient() {
  const clientId = String(process.env.PAYOS_CLIENT_ID || "").trim();
  const apiKey = String(process.env.PAYOS_API_KEY || "").trim();
  const checksumKey = String(process.env.PAYOS_CHECKSUM_KEY || "").trim();

  if (!clientId || !apiKey || !checksumKey) {
    throw new Error(
      "Chưa cấu hình đầy đủ PAYOS_CLIENT_ID, PAYOS_API_KEY và PAYOS_CHECKSUM_KEY."
    );
  }

  if (!payosClient) {
    payosClient = new PayOS({ clientId, apiKey, checksumKey });
  }

  return payosClient;
}

function getSiteBaseUrl() {
  return String(process.env.PUBLIC_SITE_URL || process.env.URL || "")
    .trim()
    .replace(/\/$/, "");
}

function getPaymentRedirectUrl(type) {
  const configured =
    type === "return"
      ? process.env.PAYOS_RETURN_URL
      : process.env.PAYOS_CANCEL_URL;

  if (configured) return new URL(configured);

  const siteBaseUrl = getSiteBaseUrl();
  if (!siteBaseUrl) {
    throw new Error(
      "Thiếu PUBLIC_SITE_URL/URL hoặc PAYOS_RETURN_URL và PAYOS_CANCEL_URL."
    );
  }

  const url = new URL("/vip", siteBaseUrl);
  if (type === "cancel") url.searchParams.set("status", "CANCEL");
  return url;
}

// =========================
// VIP PRICE
// =========================

const PRICE_MAP = {
  "1d": 5000,
  "1m": 99000,
};

// =========================
// GET USER ID FROM TOKEN
// =========================

function getUserId(req) {
  try {
    const auth = req.headers.authorization || "";

    if (!auth.startsWith("Bearer ")) {
      return null;
    }

    const token = auth.split(" ")[1];

    const payload = jwt.verify(token, JWT_SECRET);

    return payload.id;
  } catch (err) {
    return null;
  }
}

// =========================
// ADD VIP DAYS
// =========================

function addVipDays(currentVipUntil, days) {
  const now = new Date();

  const base =
    currentVipUntil && new Date(currentVipUntil) > now
      ? new Date(currentVipUntil)
      : now;

  base.setDate(base.getDate() + days);

  return base;
}

// ======================================================
// CREATE PAYMENT LINK
// POST /api/payments/payos/create-payment-link
// ======================================================

router.post("/create-payment-link", async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "Bạn cần đăng nhập.",
      });
    }

    const { plan } = req.body || {};

    const amount = PRICE_MAP[plan];

    if (!amount) {
      return res.status(400).json({
        message: "Gói VIP không hợp lệ.",
      });
    }

    const user = await User.findById(userId)
      .select("_id name email")
      .lean();

    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy user.",
      });
    }

    // orderCode phải là number
    const orderCode = Date.now();

    const planLabel =
      plan === "1d"
        ? "VIP 1 ngay"
        : "VIP 1 thang";

    // lưu order
    await VipOrder.create({
      userId: user._id,
      plan,
      amount,
      content: String(orderCode),
      orderId: String(orderCode),
      status: "pending",
    });

    // build URL chuẩn
    const returnUrl = getPaymentRedirectUrl("return");
    returnUrl.searchParams.set("orderCode", orderCode);

    const cancelUrl = getPaymentRedirectUrl("cancel");
    cancelUrl.searchParams.set("orderCode", orderCode);

    const paymentData = {
      orderCode,
      amount,
      description: planLabel,
      returnUrl: returnUrl.toString(),
      cancelUrl: cancelUrl.toString(),

      buyerName: user.name,
      buyerEmail: user.email,

      items: [
        {
          name: planLabel,
          quantity: 1,
          price: amount,
        },
      ],
    };

    console.log("CREATE PAYMENT DATA:");
    console.log(paymentData);

    const paymentLink =
      await getPayOSClient().paymentRequests.create(paymentData);

    return res.json({
      ok: true,
      checkoutUrl: paymentLink.checkoutUrl,
      orderCode,
    });
  } catch (err) {
    console.error(
      "CREATE PAYMENT ERROR:",
      err
    );

    return res.status(500).json({
      message: "Không thể tạo link thanh toán.",
    });
  }
});

// ======================================================
// WEBHOOK
// POST /api/payments/payos/webhook
// ======================================================

router.post("/webhook", async (req, res) => {
  try {
    console.log("\n===== WEBHOOK RECEIVED =====");

    console.log(
      JSON.stringify(req.body, null, 2)
    );

    const code = req.body?.code;

    // Chỉ xử lý thông báo thanh toán thành công.
    if (code !== "00") {
      console.log("Webhook ignored. CODE:", code);

      return res.status(200).json({
        ok: true,
        ignored: true,
      });
    }

    // Bắt buộc xác minh chữ ký webhook trước khi cập nhật VIP.
    // SDK sẽ throw nếu payload/signature không hợp lệ.
    const webhookData = await getPayOSClient().webhooks.verify(req.body);
    const orderCode = webhookData?.orderCode;

    console.log("CODE:", code);
    console.log("ORDER CODE:", orderCode);

    if (!orderCode) {
      console.log("Missing orderCode.");

      return res.status(200).json({
        ok: false,
        message: "Missing orderCode",
      });
    }

    // tìm order
    const order = await VipOrder.findOne({
      orderId: String(orderCode),
    });

    console.log("FOUND ORDER:");
    console.log(order);

    if (!order) {
      console.log(
        `Không tìm thấy order ${orderCode}`
      );

      return res.status(200).json({
        ok: false,
        message: "Order not found",
      });
    }

    // chống cộng VIP nhiều lần
    if (order.status === "paid") {
      console.log("Order already paid.");

      return res.status(200).json({
        ok: true,
        alreadyPaid: true,
      });
    }

    // tìm user
    const user = await User.findById(
      order.userId
    );

    if (!user) {
      console.log("User not found.");

      return res.status(200).json({
        ok: false,
        message: "User not found",
      });
    }

    // cộng VIP
    const days =
      order.plan === "1d"
        ? 1
        : 30;

    user.isVip = true;

    user.vipUntil = addVipDays(
      user.vipUntil,
      days
    );

    await user.save();

    console.log(
      `VIP updated for user ${user._id}`
    );

    // update order
    order.status = "paid";

    order.paidAt = new Date();

    await order.save();

    // notification
    await Notification.create({
      userId: order.userId,

      title: "Thanh toán VIP thành công 🎉",

      content:
        order.plan === "1d"
          ? "Bạn đã mua VIP 1 ngày thành công."
          : "Bạn đã mua VIP 1 tháng thành công.",

      type: "success",

      link: "/profile",
    });

    console.log(
      `Webhook success for order ${orderCode}`
    );

    return res.status(200).json({
      ok: true,
    });
  } catch (err) {
    console.error(
      "WEBHOOK ERROR:",
      err
    );

    return res.status(400).json({
      ok: false,
      error: "Invalid webhook",
    });
  }
});

// ======================================================
// ORDER STATUS
// GET /api/payments/payos/order-status/:orderCode
// ======================================================

router.get(
  "/order-status/:orderCode",
  async (req, res) => {
    try {
      const order =
        await VipOrder.findOne({
          orderId: String(
            req.params.orderCode
          ),
        }).lean();

      if (!order) {
        return res.status(404).json({
          message: "Không tìm thấy đơn.",
        });
      }

      return res.json({
        ok: true,
        status: order.status,
        order,
      });
    } catch (err) {
      console.error(
        "ORDER STATUS ERROR:",
        err
      );

      return res.status(500).json({
        message: "Server error",
      });
    }
  }
);

export default router;