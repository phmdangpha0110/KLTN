import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getLibraryIds, subscribeLibrary } from "../utils/library";
import { getProgress, subscribeProgress } from "../utils/progress";
import { API_BASE } from "../lib/api";

/* ==== Progress bar ==== */
function ProgressBar({ pct = 0 }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="w-full">
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-slate-800 transition-all duration-300"
          style={{ width: `${v}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-slate-500">Hoàn thành {v}%</div>
    </div>
  );
}

/* ==== Book card ==== */
function BookCard({ book }) {
  const hasTotal = Number(book.totalChapters) > 0;
  const pct = hasTotal
    ? (Number(book.lastChapter) / Number(book.totalChapters)) * 100
    : 0;

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
      <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
        <img
          src={book.cover}
          alt={book.title}
          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />
      </div>

      <div className="mt-3 min-w-0">
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-800">
          <Link to={`/novel/${book.id}`} className="transition hover:text-slate-950">
            {book.title}
          </Link>
        </h3>
        <p className="mt-1 text-xs text-slate-500">{book.author || ""}</p>
      </div>

      {/* Tiến độ đọc */}
      {book.lastChapter > 0 && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          {hasTotal ? (
            <ProgressBar pct={pct} />
          ) : (
            <div className="text-xs text-slate-600">
              Đã đọc đến chương {book.lastChapter}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center">
        <Link
          to={`/novel/${book.id}/chuong/${Math.max(1, book.lastChapter || 1)}`}
          className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-all duration-300 hover:bg-indigo-700 hover:text-white hover:scale-[1.04] hover:shadow-xl"
        >
          {book.lastChapter ? "Tiếp tục đọc" : "Đọc ngay"}
        </Link>
      </div>
    </div>
  );
}

/* ==== Loading skeleton ==== */
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="aspect-[3/4] w-full rounded-xl bg-slate-200/80" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-4/5 rounded bg-slate-200/80" />
        <div className="h-3 w-2/5 rounded bg-slate-200/80" />
      </div>
      <div className="mt-3 h-8 rounded-xl bg-slate-200/80" />
    </div>
  );
}

/* ==== Main component ==== */
export default function Library() {
  const [q, setQ] = useState("");
  const [pageSize, setPageSize] = useState(9);
  const [page, setPage] = useState(1);

  const [ids, setIds] = useState(() => getLibraryIds());
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);

  // cập nhật khi thư viện thay đổi
  useEffect(() => {
    const unsub = subscribeLibrary(setIds);
    return () => unsub();
  }, []);

  // cập nhật tiến độ giữa các tab
  useEffect(() => {
    const unsub = subscribeProgress(() => {
      setBooks((prev) =>
        prev.map((b) => ({ ...b, lastChapter: getProgress(b.id) || 0 }))
      );
    });
    return () => unsub();
  }, []);

  // nạp danh sách truyện theo ids
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const base = API_BASE || window.location.origin;

    const load = async () => {
      const norm = [];
      if (!ids.length) return norm;

      // API batch
      try {
        const qs = new URL("/api/novels", base);
        qs.searchParams.set("ids", ids.join(","));
        const r = await fetch(qs.toString());
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data)) {
            for (const n of data) {
              norm.push({
                id: n._id || n.id,
                title: n.title || "",
                author:
                  n.authorName ||
                  (typeof n.author === "string" ? n.author : n?.author?.name) ||
                  "",
                cover: n.cover || n.image || "",
                totalChapters: n.chaptersCount || n.totalChapters || 0,
              });
            }
            return norm;
          }
        }
      } catch {}

      // fallback từng id
      for (const id of ids) {
        try {
          const r = await fetch(new URL(`/api/novels/${id}`, base));
          if (!r.ok) continue;
          const n = await r.json();
          norm.push({
            id: n._id || n.id,
            title: n.title || "",
            author:
              n.authorName ||
              (typeof n.author === "string" ? n.author : n?.author?.name) ||
              "",
            cover: n.cover || n.image || "",
            totalChapters: n.chaptersCount || n.totalChapters || 0,
          });
        } catch {}
      }
      return norm;
    };

    load()
      .then((list) => {
        if (!mounted) return;
        const mapped = (list || []).map((b) => ({
          ...b,
          lastChapter: getProgress(b.id) || 0,
        }));
        setBooks(mapped);
      })
      .finally(() => mounted && setLoading(false));

    return () => (mounted = false);
  }, [ids]);

  // lọc theo từ khóa
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return books;
    return books.filter(
      (b) =>
        b.title.toLowerCase().includes(s) ||
        (b.author || "").toLowerCase().includes(s)
    );
  }, [q, books]);

  // sắp xếp theo tiến độ đọc giảm dần
  const sorted = useMemo(() => {
    return [...filtered].sort(
      (a, b) => (b.lastChapter || 0) - (a.lastChapter || 0)
    );
  }, [filtered]);

  // phân trang
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header
        onSearch={(kw) => {
          setQ(kw || "");
          setPage(1);
        }}
      />

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-slate-200 bg-white/90 backdrop-blur-xl sm:-mx-6 lg:-mx-8">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-800">
                  Thư viện của tôi
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Lưu lại những truyện đang đọc để tiếp tục bất cứ lúc nào.
                </p>
              </div>

              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                Tổng:{" "}
                <span className="font-semibold text-slate-800">
                  {filtered.length}
                </span>{" "}
                truyện
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: pageSize }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm">
            Chưa có truyện nào trong thư viện.
            <br />
            Vào trang truyện và bấm <b>“Thêm vào thư viện”</b> để lưu lại.
            <div className="mt-4">
              <Link
                to="/home"
                className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                ← Về trang chủ
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {paged.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {sorted.length > 0 && (
          <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="text-sm text-slate-600">
              Hiển thị
              <select
                className="ml-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[6, 9, 12, 18].map((n) => (
                  <option key={n} value={n}>
                    {n}/trang
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Trước
              </button>

              <span className="text-sm text-slate-700">
                {page}/{totalPages}
              </span>

              <button
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}