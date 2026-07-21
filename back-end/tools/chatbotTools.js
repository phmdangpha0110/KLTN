import Novel from "../models/Novel.js";

function escapeRegex(value = "") {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function mapNovel(novel) {
  return {
    id: novel._id.toString(),
    title: novel.title || "",
    authorName: novel.authorName || "",
    genre: novel.genre || "",
    cover: novel.cover || "",
    description: novel.description || "",
    chaptersCount: Number(
      novel.chaptersCount || 0
    ),
    views: Number(novel.views || 0),
    status: novel.status || "ongoing",

    // Link do BACKEND tạo, không để AI tự bịa
    url: `/novel/${novel._id}`,
  };
}

export async function searchNovels({
  query = "",
  genre = "",
  status = "",
  sort = "newest",
}) {
  const where = {
    // Dữ liệu cũ có thể chưa có moderationStatus.
    // Chỉ lấy truyện approved hoặc field còn thiếu, tuyệt đối bỏ blocked/uncertain.
    moderationStatus: { $in: ["approved", null] },
  };

  const cleanQuery = String(query || "").trim();
  const cleanGenre = String(genre || "").trim();

  if (cleanQuery) {
    const stopWords = new Set([
      "tìm", "tim", "truyện", "truyen", "gợi", "goi", "ý", "y",
      "cho", "mình", "minh", "tôi", "toi", "muốn", "muon", "đọc",
      "doc", "có", "co", "nào", "nao", "về", "ve", "thể", "loại",
      "the", "loai", "một", "mot", "những", "nhung", "hay", "với",
      "voi", "phù", "hợp", "phu", "hop",
    ]);

    const terms = cleanQuery
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((value) => value.trim())
      .filter((value) => value.length >= 2 && !stopWords.has(value))
      .slice(0, 8);

    const searchValues = terms.length ? terms : [cleanQuery];
    const regexes = searchValues.map(
      (value) => new RegExp(escapeRegex(value), "i")
    );

    where.$or = regexes.flatMap((regex) => [
      { title: regex },
      { authorName: regex },
      { description: regex },
      { genre: regex },
    ]);
  }

  if (cleanGenre) {
    where.genre = new RegExp(
      escapeRegex(cleanGenre),
      "i"
    );
  }

  if (
    status === "ongoing" ||
    status === "completed"
  ) {
    where.status = status;
  }

  let sortOption = {
    createdAt: -1,
  };

  if (sort === "views") {
    sortOption = {
      views: -1,
      createdAt: -1,
    };
  }

  if (sort === "chapters") {
    sortOption = {
      chaptersCount: -1,
      createdAt: -1,
    };
  }

  const novels = await Novel.find(where)
    .sort(sortOption)
    .limit(6)
    .select(
      [
        "title",
        "authorName",
        "genre",
        "cover",
        "description",
        "chaptersCount",
        "views",
        "status",
      ].join(" ")
    )
    .lean();

  return novels.map(mapNovel);
}

export async function getNovelDetail({
  novelId,
}) {
  const id = String(novelId || "").trim();

  if (!id) {
    return {
      found: false,
      message: "Thiếu mã truyện.",
    };
  }

  const novel = await Novel.findById(id)
    .select(
      [
        "title",
        "authorName",
        "genre",
        "cover",
        "description",
        "chaptersCount",
        "views",
        "status",
        "moderationStatus",
      ].join(" ")
    )
    .lean();

  if (
    !novel ||
    (novel.moderationStatus && novel.moderationStatus !== "approved")
  ) {
    return {
      found: false,
      message: "Không tìm thấy truyện.",
    };
  }

  return {
    found: true,
    novel: mapNovel(novel),
  };
}

const SITE_GUIDES = {
  favorite: {
    title: "Thêm truyện yêu thích",
    answer:
      "Mở trang chi tiết truyện và sử dụng chức năng Yêu thích. Bạn có thể xem lại danh sách tại trang Yêu thích.",
    url: "/favorites",
  },

  studio: {
    title: "Đăng và quản lý truyện",
    answer:
      "Tác giả có thể vào Studio để đăng truyện mới, chỉnh sửa tác phẩm và quản lý chương.",
    url: "/studio",
  },

  vip: {
    title: "Nâng cấp VIP",
    answer:
      "Bạn có thể xem và nâng cấp gói VIP tại trang VIP của DKStory.",
    url: "/vip",
  },

  chat: {
    title: "Nhắn tin",
    answer:
      "Bạn có thể vào trang Chat để tìm và nhắn tin với người dùng khác.",
    url: "/chat",
  },

  notification: {
    title: "Thông báo",
    answer:
      "Các thông báo của tài khoản được hiển thị tại trang Thông báo.",
    url: "/notifications",
  },
};

export async function getSiteGuide({
  topic = "",
}) {
  const value = String(topic || "")
    .trim()
    .toLowerCase();

  let key = null;

  if (
    value.includes("yêu thích") ||
    value.includes("favorite")
  ) {
    key = "favorite";
  } else if (
    value.includes("đăng truyện") ||
    value.includes("tác giả") ||
    value.includes("studio") ||
    value.includes("chương")
  ) {
    key = "studio";
  } else if (
    value.includes("vip") ||
    value.includes("nâng cấp")
  ) {
    key = "vip";
  } else if (
    value.includes("chat") ||
    value.includes("nhắn tin")
  ) {
    key = "chat";
  } else if (
    value.includes("thông báo")
  ) {
    key = "notification";
  }

  if (!key) {
    return {
      found: false,
      message:
        "Chưa có hướng dẫn phù hợp với câu hỏi này.",
    };
  }

  return {
    found: true,
    guide: SITE_GUIDES[key],
  };
}