import Report from "../models/Report.js";
import { checkTextModeration } from "./openaiModeration.js";

export async function createAiReportIfFlagged({
  type,
  text,
  novelId,
  chapterNo,
  commentId,
  userId,
}) {
  const aiCheck = await checkTextModeration(text);

  if (!aiCheck.flagged) {
    return {
      created: false,
      aiCheck,
    };
  }

  const existed = await Report.findOne({
    source: "ai",
    type,
    novelId: novelId || undefined,
    chapterNo: chapterNo || undefined,
    commentId: commentId || undefined,
    status: { $in: ["pending", "reviewing"] },
  }).lean();

  if (existed) {
    return {
      created: false,
      aiCheck,
      existed: true,
    };
  }

  const report = await Report.create({
    source: "ai",
    type,
    novelId: novelId || undefined,
    chapterNo: type === "chapter" ? Number(chapterNo) : undefined,
    commentId: type === "comment" ? commentId : undefined,
    userId: userId || null,
    reason: "AI phát hiện nội dung có dấu hiệu vi phạm",
    description:
      aiCheck.flaggedCategories.length > 0
        ? `Các nhóm nghi vi phạm: ${aiCheck.flaggedCategories.join(", ")}`
        : "AI đánh dấu nội dung cần Admin xem xét lại.",
    status: "pending",
    aiModeration: {
      flagged: aiCheck.flagged,
      flaggedCategories: aiCheck.flaggedCategories,
      categories: aiCheck.categories,
      category_scores: aiCheck.category_scores,
      error: aiCheck.error || "",
    },
  });

  return {
    created: true,
    report,
    aiCheck,
  };
}