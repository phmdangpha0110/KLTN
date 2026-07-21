import { Router } from "express";

import {
  askChatbot,
} from "../services/chatbotService.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const message = String(
      req.body?.message || ""
    ).trim();

    if (!message) {
      return res.status(400).json({
        message:
          "Vui lòng nhập câu hỏi.",
      });
    }

    if (message.length > 1500) {
      return res.status(400).json({
        message:
          "Câu hỏi quá dài. Vui lòng nhập ngắn gọn hơn.",
      });
    }

    const result = await askChatbot({
      message,
    });

    return res.json(result);
  } catch (error) {
    console.error(
      "[POST /api/chatbot]",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Chatbot hiện không thể phản hồi.",
    });
  }
});

export default router;