import { BLACKLIST_WORDS } from "../config/blacklist.js";

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/[@4]/g, "a")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[0]/g, "o")
    .replace(/[_\-.*~`'"()[\]{}]/g, "");
}

export function checkBlacklist(text) {
  const content = normalizeText(text);
  const foundWords = [];

  for (const word of BLACKLIST_WORDS) {
    const normalizedWord = normalizeText(word);

    if (content.includes(normalizedWord)) {
      foundWords.push(word);
    }
  }

  return {
    flagged: foundWords.length > 0,
    words: [...new Set(foundWords)],
  };
}