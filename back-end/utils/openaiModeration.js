import OpenAI from "openai";

let openaiClient;

function getOpenAIClient() {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }

  return openaiClient;
}

export async function checkTextModeration(text) {
  try {
    const input = String(text || "").trim();
    const openai = getOpenAIClient();

    if (!input || !openai) {
      return {
        ok: true,
        flagged: false,
        flaggedCategories: [],
        categories: {},
        category_scores: {},
        error: null,
      };
    }

    const response = await openai.moderations.create({
      model: "omni-moderation-latest",
      input,
    });

    const result = response.results?.[0];

    const flaggedCategories = Object.entries(result?.categories || {})
      .filter(([, value]) => value === true)
      .map(([key]) => key);

    return {
      ok: true,
      flagged: Boolean(result?.flagged),
      flaggedCategories,
      categories: result?.categories || {},
      category_scores: result?.category_scores || {},
      raw: result,
      error: null,
    };
  } catch (error) {
    console.error("[OpenAI Moderation Error]", error);

    return {
      ok: false,
      flagged: false,
      flaggedCategories: [],
      categories: {},
      category_scores: {},
      error: error.message || "Moderation failed",
    };
  }
}
