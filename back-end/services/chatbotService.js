import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  Type,
} from "@google/genai";

import {
  searchNovels,
  getNovelDetail,
  getSiteGuide,
} from "../tools/chatbotTools.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

const SYSTEM_INSTRUCTION = `
Bạn là DKBot, trợ lý của website đọc truyện DKStory.

Nhiệm vụ duy nhất của bạn là phân tích yêu cầu người dùng và chọn đúng công cụ DKStory.

QUY TẮC BẮT BUỘC:
- Tìm truyện, hỏi có truyện nào, gợi ý truyện, mô tả sở thích, thể loại, nội dung, lượt xem, số chương, truyện mới hoặc trạng thái: gọi search_novels.
- Hỏi chi tiết một truyện khi đã có ID: gọi get_novel_detail.
- Hỏi cách sử dụng DKStory: gọi get_site_guide.
- Chào hỏi, cảm ơn hoặc trò chuyện thông thường: gọi general_chat.
- Không dùng kiến thức về sách, truyện, phim hoặc tiểu thuyết bên ngoài DKStory.
- Không bịa tên truyện, ID hoặc URL.
- Luôn gọi đúng một công cụ.
`;

const functionDeclarations = [
  {
    name: "search_novels",
    description:
      "Tìm hoặc gợi ý truyện thực sự có trong MongoDB của DKStory. Dùng cho mọi yêu cầu tìm kiếm hoặc gợi ý truyện.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description:
            "Từ khóa ngắn về tên, tác giả hoặc nội dung. Dùng chuỗi rỗng nếu yêu cầu chỉ nêu thể loại/sắp xếp.",
        },
        genre: {
          type: Type.STRING,
          description:
            "Tên thể loại được người dùng yêu cầu. Dùng chuỗi rỗng nếu không xác định rõ.",
        },
        status: {
          type: Type.STRING,
          enum: ["", "ongoing", "completed"],
          description: "Trạng thái truyện.",
        },
        sort: {
          type: Type.STRING,
          enum: ["newest", "views", "chapters"],
          description: "Cách sắp xếp kết quả.",
        },
      },
      required: ["query", "genre", "status", "sort"],
    },
  },
  {
    name: "get_novel_detail",
    description:
      "Lấy thông tin một truyện DKStory bằng ID thật đã có từ kết quả tìm kiếm.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        novelId: {
          type: Type.STRING,
          description: "ID truyện có thật trên DKStory.",
        },
      },
      required: ["novelId"],
    },
  },
  {
    name: "get_site_guide",
    description: "Lấy hướng dẫn sử dụng chức năng của website DKStory.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        topic: {
          type: Type.STRING,
          description: "Chức năng DKStory người dùng cần hướng dẫn.",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "general_chat",
    description:
      "Dùng cho chào hỏi, cảm ơn hoặc trò chuyện thông thường không liên quan tìm truyện và chức năng DKStory.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        message: {
          type: Type.STRING,
          description: "Nội dung trò chuyện của người dùng.",
        },
      },
      required: ["message"],
    },
  },
];

const ALLOWED_TOOL_NAMES = functionDeclarations.map((item) => item.name);

function getAIClient() {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();

  if (!apiKey) {
    throw new Error("Chưa cấu hình GEMINI_API_KEY.");
  }

  return new GoogleGenAI({ apiKey });
}

function createSearchAnswer(novels) {
  if (!Array.isArray(novels) || novels.length === 0) {
    return (
      "Hiện mình chưa tìm thấy truyện phù hợp trong DKStory. " +
      "Bạn thử mô tả tên, thể loại hoặc nội dung khác nhé."
    );
  }

  if (novels.length === 1) {
    return "Mình tìm thấy 1 truyện phù hợp trên DKStory. Bạn xem bên dưới nhé 👇";
  }

  return `Mình tìm thấy ${novels.length} truyện phù hợp trên DKStory. Bạn xem thử nhé 👇`;
}

function createNovelDetailAnswer(result) {
  if (!result?.found || !result?.novel) {
    return "Mình không tìm thấy truyện này trên DKStory.";
  }

  const novel = result.novel;

  return [
    `Mình đã tìm thấy truyện \"${novel.title}\".`,
    novel.genre ? `Thể loại: ${novel.genre}.` : "",
    `Hiện có ${novel.chaptersCount || 0} chương.`,
    `Lượt xem: ${novel.views || 0}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function createGuideAnswer(result) {
  if (!result?.found || !result?.guide) {
    return (
      "Mình chưa có hướng dẫn phù hợp với câu hỏi này. " +
      "Bạn thử hỏi cụ thể hơn nhé."
    );
  }

  return result.guide.answer;
}

function createGeneralAnswer(message) {
  const text = String(message || "").trim().toLowerCase();

  if (
    text.includes("xin chào") ||
    text === "hello" ||
    text === "hi" ||
    text === "chào"
  ) {
    return (
      "Xin chào 👋 Mình là DKBot. " +
      "Mình có thể giúp bạn tìm truyện và hướng dẫn sử dụng DKStory."
    );
  }

  if (text.includes("cảm ơn") || text.includes("thank")) {
    return "Không có gì 😄 Rất vui được hỗ trợ bạn!";
  }

  return (
    "Mình là trợ lý của DKStory 😄 " +
    "Bạn có thể nhờ mình tìm truyện hoặc hỏi cách sử dụng website nhé."
  );
}

async function executeTool(name, args) {
  switch (name) {
    case "search_novels":
      return searchNovels(args || {});
    case "get_novel_detail":
      return getNovelDetail(args || {});
    case "get_site_guide":
      return getSiteGuide(args || {});
    case "general_chat":
      return { message: args?.message || "" };
    default:
      throw new Error(`Tool không tồn tại: ${name}`);
  }
}

function normalizeToolCall(call) {
  const name = String(call?.name || "").trim();
  const args = call?.args && typeof call.args === "object" ? call.args : {};

  if (!ALLOWED_TOOL_NAMES.includes(name)) {
    return null;
  }

  return { name, args };
}

function classifyLocally(message) {
  const raw = String(message || "").trim();
  const text = raw.toLowerCase();

  const guideWords = [
    "yêu thích",
    "favorite",
    "đăng truyện",
    "quản lý truyện",
    "studio",
    "nâng cấp",
    "vip",
    "nhắn tin",
    "chat với",
    "thông báo",
  ];

  if (guideWords.some((word) => text.includes(word))) {
    return {
      name: "get_site_guide",
      args: { topic: raw },
    };
  }

  const searchWords = [
    "tìm",
    "truyện",
    "gợi ý",
    "đọc gì",
    "thể loại",
    "tình cảm",
    "kinh dị",
    "tiên hiệp",
    "ngôn tình",
    "hành động",
    "phiêu lưu",
    "nhiều lượt xem",
    "nhiều chương",
    "mới nhất",
    "hoàn thành",
  ];

  if (searchWords.some((word) => text.includes(word))) {
    let sort = "newest";
    if (text.includes("lượt xem") || text.includes("đọc nhiều")) sort = "views";
    if (text.includes("nhiều chương")) sort = "chapters";

    let status = "";
    if (text.includes("hoàn thành")) status = "completed";
    if (text.includes("đang tiến hành") || text.includes("đang ra")) status = "ongoing";

    return {
      name: "search_novels",
      args: {
        query: raw,
        genre: "",
        status,
        sort,
      },
    };
  }

  return {
    name: "general_chat",
    args: { message: raw },
  };
}

async function chooseToolWithGemini(message) {
  const ai = getAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: message,
      config: {
        abortSignal: controller.signal,
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0,
        tools: [{ functionDeclarations }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: ALLOWED_TOOL_NAMES,
          },
        },
      },
    });

    const call = normalizeToolCall(response.functionCalls?.[0]);

    if (!call) {
      throw new Error("Gemini không trả về function call hợp lệ.");
    }

    return call;
  } finally {
    clearTimeout(timeout);
  }
}

function buildResponse(name, result) {
  switch (name) {
    case "search_novels": {
      const novels = Array.isArray(result) ? result : [];
      return {
        answer: createSearchAnswer(novels),
        novels,
        guides: [],
      };
    }
    case "get_novel_detail":
      return {
        answer: createNovelDetailAnswer(result),
        novels: result?.found && result?.novel ? [result.novel] : [],
        guides: [],
      };
    case "get_site_guide":
      return {
        answer: createGuideAnswer(result),
        novels: [],
        guides: result?.found && result?.guide ? [result.guide] : [],
      };
    case "general_chat":
      return {
        answer: createGeneralAnswer(result?.message),
        novels: [],
        guides: [],
      };
    default:
      return {
        answer: "Mình chưa xử lý được yêu cầu này.",
        novels: [],
        guides: [],
      };
  }
}

export async function askChatbot({ message }) {
  const text = String(message || "").trim();

  if (!text) {
    throw new Error("Vui lòng nhập câu hỏi.");
  }

  let call;

  try {
    call = await chooseToolWithGemini(text);
    console.log("[CHATBOT GEMINI TOOL]", call.name, call.args);
  } catch (error) {
    // Vẫn cho người dùng tìm dữ liệu DKStory nếu Gemini tạm lỗi/quota/network.
    // Fallback chỉ phân loại intent; câu trả lời và tên truyện vẫn lấy từ backend/MongoDB.
    console.error("[CHATBOT GEMINI] fallback local:", error?.message || error);
    call = classifyLocally(text);
  }

  try {
    const result = await executeTool(call.name, call.args);
    return buildResponse(call.name, result);
  } catch (error) {
    console.error(`[CHATBOT TOOL ${call.name}]`, error);
    return {
      answer:
        "DKBot hiện không thể lấy dữ liệu từ DKStory. Bạn thử lại sau nhé.",
      novels: [],
      guides: [],
    };
  }
}
