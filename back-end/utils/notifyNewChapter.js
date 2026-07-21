// back-end/utils/notifyNewChapter.js
//
// Gọi hàm này ngay sau khi một chương mới được tạo thành công.
// Nó sẽ:
//   1. Tìm tất cả Favorite record của novel đó
//   2. Tạo một Notification cho mỗi user đã yêu thích (bulk insertMany)
//
// Hàm này KHÔNG throw — lỗi chỉ được log, không ảnh hưởng response chính.

import Favorite from "../models/Favorite.js";
import Notification from "../models/Notification.js";

/**
 * @param {object} params
 * @param {string|import("mongoose").Types.ObjectId} params.novelId
 * @param {string}  params.novelTitle   - tên truyện (để hiện trong thông báo)
 * @param {number}  params.chapterNo    - số chương vừa thêm
 * @param {string}  params.chapterTitle - tiêu đề chương (có thể rỗng)
 */
export async function notifyFavoriteUsers({
  novelId,
  novelTitle,
  chapterNo,
  chapterTitle,
}) {
  try {
    // 1. Lấy danh sách user đã yêu thích novel này
    const favorites = await Favorite.find({ novelId })
      .select("userId")
      .lean();

    if (!favorites.length) return;

    const title = `📖 ${novelTitle} vừa ra chương mới!`;
    const chLabel = chapterTitle
      ? `Chương ${chapterNo}: ${chapterTitle}`
      : `Chương ${chapterNo}`;
    const content = `${chLabel} đã được đăng. Đọc ngay nhé!`;
    const link = `/novel/${novelId}/chuong/${chapterNo}`;
    const now = new Date();

    // 2. Tạo batch notifications — insertMany bỏ qua duplicate nếu có
    const docs = favorites.map((f) => ({
      userId: f.userId,
      title,
      content,
      type: "new_chapter",
      link,
      read: false,
      createdAt: now,
    }));

    await Notification.insertMany(docs, { ordered: false });

    console.log(
      `[notifyNewChapter] Sent ${docs.length} notifications` +
        ` → novel "${novelTitle}" chap ${chapterNo}`
    );
  } catch (err) {
    // Không để lỗi này làm hỏng response tạo chương
    console.error("[notifyNewChapter] Error:", err.message || err);
  }
}