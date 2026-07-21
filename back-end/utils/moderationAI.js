import fetch from "node-fetch";

function skippedResult(message) {
  return {
    label: "safe",
    is_safe: true,
    safe_score: 1,
    unsafe_score: 0,
    safe_percent: 100,
    unsafe_percent: 0,
    skipped: true,
    message,
  };
}

export async function checkCoverByUrl(imageUrl) {
  if (!imageUrl) {
    return skippedResult("Không có ảnh bìa.");
  }

  const aiServiceUrl = String(process.env.AI_SERVICE_URL || "")
    .trim()
    .replace(/\/$/, "");

  // Netlify không chạy FastAPI/TensorFlow service này như một Node Function.
  // Khi chưa cấu hình AI_SERVICE_URL public, không gọi localhost và không làm hỏng chức năng đăng truyện.
  if (!aiServiceUrl) {
    console.warn("[COVER MODERATION] AI_SERVICE_URL chưa cấu hình, bỏ qua kiểm duyệt ảnh bìa.");
    return skippedResult("Chưa cấu hình dịch vụ kiểm duyệt ảnh bìa trên production.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${aiServiceUrl}/predict-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_url: imageUrl }),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.label === "error") {
      throw new Error(data.message || `AI moderation HTTP ${res.status}`);
    }

    return data;
  } catch (error) {
    console.error("[COVER MODERATION] Service unavailable:", error?.message || error);
    return skippedResult("Dịch vụ kiểm duyệt ảnh bìa đang tạm thời không khả dụng.");
  } finally {
    clearTimeout(timeout);
  }
}
