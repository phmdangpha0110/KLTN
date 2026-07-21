import { Router } from "express";
import VipOrder from "../models/VipOrder.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { requireAdmin } from "../utils/requireAdmin.js";
import { expireAllExpiredVip } from "../utils/vipStatus.js";

const router = Router();

function addVipDays(currentVipUntil, plan) {
  const now = new Date();
  const base =
    currentVipUntil && new Date(currentVipUntil) > now
      ? new Date(currentVipUntil)
      : now;

  if (plan === "1d") base.setDate(base.getDate() + 1);
  else if (plan === "1m") base.setDate(base.getDate() + 30);

  return base;
}

router.get("/", requireAdmin, async (req, res) => {
  try {
    await expireAllExpiredVip();
    const { status = "" } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const items = await VipOrder.find(filter)
      .populate("userId", "name email isVip vipUntil")
      .populate("confirmedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ items });
  } catch (err) {
    console.error("GET /admin/vip-orders error:", err);
    res.status(500).json({ message: "Không thể tải danh sách đơn VIP." });
  }
});

router.post("/:id/confirm", requireAdmin, async (req, res) => {
  try {
    const { adminNote = "" } = req.body || {};

    const order = await VipOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn thanh toán." });
    }

    if (order.status === "paid") {
      return res.status(400).json({ message: "Đơn này đã được xác nhận trước đó." });
    }

    if (order.status !== "pending") {
      return res.status(400).json({ message: "Chỉ có thể xác nhận đơn đang chờ thanh toán." });
    }

    const user = await User.findById(order.userId);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng của đơn này." });
    }

    user.vipUntil = addVipDays(user.vipUntil, order.plan);
    user.isVip = true;
    await user.save();

    order.status = "paid";
    order.paidAt = new Date();
    order.confirmedBy = req.userId;
    order.adminNote = adminNote.trim();
    await order.save();

    await Notification.create({
      userId: user._id,
      title: "Thanh toán VIP đã được xác nhận",
      content: `Đơn ${order.orderId} đã được quản trị viên xác nhận. Tài khoản của bạn đã được nâng cấp VIP.`,
      type: "success",
      link: "/profile",
    });

    res.json({
      message: "Đã xác nhận thanh toán và cộng VIP cho người dùng.",
      order,
      vipUntil: user.vipUntil,
    });
  } catch (err) {
    console.error("POST /admin/vip-orders/:id/confirm error:", err);
    res.status(500).json({ message: "Không thể xác nhận đơn VIP." });
  }
});

router.post("/:id/cancel", requireAdmin, async (req, res) => {
  try {
    const { adminNote = "" } = req.body || {};

    const order = await VipOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Không tìm thấy đơn thanh toán." });
    }

    if (order.status === "paid") {
      return res.status(400).json({ message: "Không thể hủy đơn đã thanh toán." });
    }

    order.status = "cancelled";
    order.adminNote = adminNote.trim();
    order.confirmedBy = req.userId;
    await order.save();

    res.json({ message: "Đã hủy đơn thanh toán.", order });
  } catch (err) {
    console.error("POST /admin/vip-orders/:id/cancel error:", err);
    res.status(500).json({ message: "Không thể hủy đơn VIP." });
  }
});

export default router;