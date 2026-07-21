import { Router } from "express";
import mongoose from "mongoose";
import ChapterViewLog from "../models/ChapterViewLog.js";
import AuthorMonthlyRevenue from "../models/AuthorMonthlyRevenue.js";
import User from "../models/User.js";
import { requireAdmin } from "../utils/requireAdmin.js";
import Notification from "../models/Notification.js";

const router = Router();

const PLATFORM_FEE_PERCENT = 50;

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { month = "" } = req.query;

    const filter = {};
    if (month) filter.month = month;

    const items = await AuthorMonthlyRevenue.find(filter)
      .populate("authorId", "name email")
      .sort({ month: -1, amount: -1 })
      .lean();

    res.json({ items });
  } catch (err) {
    console.error("GET /admin/revenue error:", err);
    res.status(500).json({ message: "Không thể tải doanh thu tác giả." });
  }
});

router.post("/calculate", requireAdmin, async (req, res) => {
  try {
    const { month, grossRevenue } = req.body || {};

    if (!month) {
      return res.status(400).json({ message: "Thiếu tháng cần tính." });
    }

    const revenue = Number(grossRevenue || 0);

    if (!revenue || revenue <= 0) {
      return res.status(400).json({ message: "Doanh thu tháng không hợp lệ." });
    }

    const authorPool = Math.round(
      revenue * ((100 - PLATFORM_FEE_PERCENT) / 100)
    );

    const rows = await ChapterViewLog.aggregate([
      {
        $match: {
          month,
          isPaid: true,
        },
      },
      {
        $group: {
          _id: "$authorId",
          paidViews: { $sum: 1 },
        },
      },
      {
        $sort: {
          paidViews: -1,
        },
      },
    ]);

    const totalPaidViews = rows.reduce(
      (sum, r) => sum + Number(r.paidViews || 0),
      0
    );

    if (totalPaidViews <= 0) {
      return res.status(400).json({
        message: "Tháng này chưa có lượt đọc chương kiếm tiền.",
      });
    }

    const results = [];

    for (const row of rows) {
      const authorId = row._id;
      const paidViews = Number(row.paidViews || 0);
      const sharePercent = paidViews / totalPaidViews;
      const amount = Math.round(authorPool * sharePercent);

      const doc = await AuthorMonthlyRevenue.findOneAndUpdate(
        {
          authorId,
          month,
        },
        {
          authorId,
          month,
          paidViews,
          totalPaidViews,
          grossRevenue: revenue,
          platformFeePercent: PLATFORM_FEE_PERCENT,
          authorPool,
          sharePercent: Number((sharePercent * 100).toFixed(2)),
          amount,
          status: "pending",
          paidAt: null,
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      ).lean();

      results.push(doc);
    }

    res.json({
      message: "Đã tính doanh thu tác giả.",
      month,
      grossRevenue: revenue,
      platformFeePercent: PLATFORM_FEE_PERCENT,
      authorPool,
      totalPaidViews,
      items: results,
    });
  } catch (err) {
    console.error("POST /admin/revenue/calculate error:", err);
    res.status(500).json({ message: "Không thể tính doanh thu." });
  }
});

router.post("/:id/mark-paid", requireAdmin, async (req, res) => {
  try {
    const item = await AuthorMonthlyRevenue.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: "Không tìm thấy bản ghi." });
    }

    item.status = "paid";
    item.paidAt = new Date();

    await item.save();
    await Notification.create({
      userId: item.authorId,
      title: "Doanh thu tác giả đã được thanh toán",
      content: `Doanh thu tháng ${item.month} với số tiền ${Number(
        item.amount || 0
      ).toLocaleString("vi-VN")}đ đã được admin đánh dấu thanh toán.`,
      type: "revenue",
      link: "/studio/wallet",
    });

    res.json({
      message: "Đã đánh dấu đã thanh toán cho tác giả.",
      item,
    });
  } catch (err) {
    console.error("POST /admin/revenue/:id/mark-paid error:", err);
    res.status(500).json({ message: "Không thể cập nhật thanh toán." });
  }
});

export default router;