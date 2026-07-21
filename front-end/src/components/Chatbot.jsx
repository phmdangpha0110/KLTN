import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

const WELCOME_MESSAGE = {
  role: "bot",
  answer:
    "Xin chào 👋 Mình là DKBot. Bạn có thể nhờ mình tìm truyện có trên DKStory hoặc hỏi cách sử dụng website.",
  novels: [],
  guides: [],
};

function MessageBubble({ item }) {
  const isUser = item.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
          isUser
            ? "rounded-br-md bg-slate-900 text-white"
            : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
        }`}
      >
        <p className="whitespace-pre-wrap">{item.answer}</p>

        {!isUser && item.novels?.length > 0 && (
          <div className="mt-3 space-y-2">
            {item.novels.map((novel) => (
              <Link
                key={novel.id}
                to={novel.url || `/novel/${novel.id}`}
                className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2 transition hover:border-slate-300 hover:bg-slate-100"
              >
                <img
                  src={novel.cover || ""}
                  alt={novel.title}
                  className="h-20 w-14 shrink-0 rounded-lg bg-slate-200 object-cover"
                />
                <div className="min-w-0 py-0.5">
                  <p className="line-clamp-2 font-semibold text-slate-800">
                    {novel.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {novel.authorName || "Chưa rõ tác giả"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    {novel.genre || "Chưa có thể loại"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isUser && item.guides?.length > 0 && (
          <div className="mt-3 space-y-2">
            {item.guides.map((guide) => (
              <Link
                key={`${guide.url}-${guide.title}`}
                to={guide.url || "/home"}
                className="block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-slate-300 hover:bg-slate-100"
              >
                <p className="font-semibold text-slate-800">{guide.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">Mở chức năng →</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, open]);

  async function submitMessage(event) {
    event?.preventDefault();

    const text = message.trim();
    if (!text || loading) return;

    setMessage("");
    setMessages((prev) => [
      ...prev,
      { role: "user", answer: text, novels: [], guides: [] },
    ]);
    setLoading(true);

    try {
      const result = await api.chatbot.ask(text);
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          answer: result?.answer || "DKBot chưa có câu trả lời phù hợp.",
          novels: Array.isArray(result?.novels) ? result.novels : [],
          guides: Array.isArray(result?.guides) ? result.guides : [],
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          answer:
            error?.message || "Không thể kết nối DKBot. Bạn thử lại sau nhé.",
          novels: [],
          guides: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[70] sm:bottom-6 sm:right-6">
      {open && (
        <section className="mb-3 flex h-[min(620px,calc(100vh-120px))] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl shadow-slate-900/20">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3.5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-lg">
                ✨
              </div>
              <div>
                <p className="font-semibold">DKBot</p>
                <p className="text-xs text-slate-300">Trợ lý tìm truyện DKStory</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
              aria-label="Đóng chatbot"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((item, index) => (
              <MessageBubble key={`${item.role}-${index}`} item={item} />
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                  DKBot đang tìm trong DKStory...
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={submitMessage} className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-slate-300 focus-within:ring-4 focus-within:ring-slate-100">
              <textarea
                rows={1}
                maxLength={1500}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitMessage(event);
                  }
                }}
                placeholder="Ví dụ: Gợi ý truyện tình cảm..."
                className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!message.trim() || loading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Gửi tin nhắn"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/25 transition hover:-translate-y-0.5 hover:bg-slate-800"
        aria-label={open ? "Đóng DKBot" : "Mở DKBot"}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7">
            <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
            <path d="M8 9h8M8 13h5" />
          </svg>
        )}
      </button>
    </div>
  );
}
