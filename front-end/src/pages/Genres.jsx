// src/pages/Genres.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { api, API_BASE } from "../lib/api";

// =============== Helpers ==================
const BOOKS_PER_PAGE_OPTIONS = [6, 9, 12, 18];

const pickArray = (res) => {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.items)) return res.items;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
};

function BookCard({ book }) {
  return (
    <div className="group rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
      <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
        <img
          src={book.cover}
          alt={book.title}
          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />
      </div>

      <div className="mt-4 min-w-0">
        <h3 className="line-clamp-2 text-base font-semibold text-slate-800">
          <Link to={`/novel/${book.id}`} className="transition hover:text-slate-950">
            {book.title}
          </Link>
        </h3>

        <p className="mt-1 text-sm text-slate-500">{book.author}</p>

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
          {book.description}
        </p>
      </div>

      <div className="mt-4">
        <Link
          to={`/novel/${book.id}`}
          className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-indigo-700 hover:text-white hover:scale-[1.04] hover:shadow-xl"
        >
          Đọc chi tiết
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
            <path
              fillRule="evenodd"
              d="M12.97 3.97a.75.75 0 011.06 0l7 7a.75.75 0 010 1.06l-7 7a.75.75 0 01-1.06-1.06l5.72-5.72H3.75a.75.75 0 010-1.5h14.94l-5.72-5.72a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="aspect-[3/4] w-full rounded-2xl bg-slate-200/80" />
      <div className="mt-4 space-y-2">
        <div className="h-4 w-4/5 rounded bg-slate-200/80" />
        <div className="h-3 w-2/5 rounded bg-slate-200/80" />
        <div className="h-3 w-full rounded bg-slate-200/80" />
      </div>
      <div className="mt-4 h-9 rounded-2xl bg-slate-200/80" />
    </div>
  );
}

export default function Genres() {
  const [sp, setSp] = useSearchParams();

  // --- state (đồng bộ URL như cũ) ---
  const [active, setActive] = useState(sp.get("g") || "");
  const [query, setQuery] = useState(sp.get("q") || "");
  const [sortBy, setSortBy] = useState(sp.get("sort") || "title-asc");
  const [pageSize, setPageSize] = useState(Number(sp.get("ps")) || 12);
  const [page, setPage] = useState(Number(sp.get("p")) || 1);

  // --- dữ liệu từ API ---
  const [genres, setGenres] = useState([]); // tên thể loại
  const [allNovels, setAllNovels] = useState([]); // toàn bộ truyện
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // tải genres + novels
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");

    const loadGenres = async () => {
      try {
        const res = await api.getGenres();
        const arr = pickArray(res).map((g) =>
          typeof g === "string" ? g : g?.name || g?.title || ""
        );
        return arr.filter(Boolean);
      } catch {
        return [];
      }
    };

    const loadNovels = async () => {
      const url = new URL("/api/novels", API_BASE || window.location.origin);
      const res = await fetch(url.toString()).then((r) => r.json());
      const rows = pickArray(res);

      return rows.map((n) => ({
        id: n._id || n.id,
        title: n.title || "",
        cover: n.cover || n.image || "",
        author:
          n.authorName ||
          (typeof n.author === "string" ? n.author : n?.author?.name) ||
          "",
        description: n.description || "",
        genre: n.genre || n.genreName || "",
      }));
    };

    (async () => {
      try {
        const [g, books] = await Promise.all([loadGenres(), loadNovels()]);
        if (!mounted) return;

        setAllNovels(books);

        // nếu API genres rỗng → tự sinh từ novels
        if (g.length) setGenres(g);
        else {
          const derived = Array.from(
            new Set(books.map((b) => b.genre).filter(Boolean))
          ).sort((a, b) => a.localeCompare(b, "vi"));
          setGenres(derived);
        }

        // nếu chưa có active (lần đầu) → chọn thể loại đầu tiên
        setActive((prev) => prev || (g[0] || books[0]?.genre || "") || "");
      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || "Lỗi tải dữ liệu");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Sync URL khi filter đổi
  useEffect(() => {
    const next = new URLSearchParams(sp);
    if (active) next.set("g", active);
    else next.delete("g");
    query ? next.set("q", query) : next.delete("q");
    next.set("sort", sortBy);
    next.set("ps", String(pageSize));
    next.set("p", String(page));
    setSp(next, { replace: true });
  }, [active, query, sortBy, pageSize, page]);

  // đếm số truyện theo thể loại
  const counts = useMemo(() => {
    const m = {};
    genres.forEach((g) => (m[g] = 0));
    allNovels.forEach((b) => {
      const g = b.genre || "Khác";
      m[g] = (m[g] || 0) + 1;
    });
    return m;
  }, [genres, allNovels]);

  // danh sách sách theo thể loại đang chọn
  const allBooks = useMemo(() => {
    return allNovels.filter((b) => (active ? b.genre === active : true));
  }, [allNovels, active]);

  // lọc + sắp xếp
  const filtered = useMemo(() => {
    let list = [...allBooks];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          (b.description || "").toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case "title-asc":
        list.sort((a, b) => a.title.localeCompare(b.title, "vi"));
        break;
      case "title-desc":
        list.sort((a, b) => b.title.localeCompare(a.title, "vi"));
        break;
      case "author-asc":
        list.sort((a, b) => a.author.localeCompare(b.author, "vi"));
        break;
      case "author-desc":
        list.sort((a, b) => b.author.localeCompare(a.author, "vi"));
        break;
      default:
        break;
    }

    return list;
  }, [allBooks, query, sortBy]);

  // phân trang
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // handlers
  function handlePickGenre(g) {
    setActive(g);
    setPage(1);
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header
        onSearch={(kw) => {
          setQuery(kw || "");
          setPage(1);
        }}
      />

      <main className="mx-auto flex-1 w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        {/* Title & controls */}
        <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-slate-200 bg-white/90 backdrop-blur-xl sm:-mx-6 lg:-mx-8">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-800">
                Thể loại
              </h1>

              <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
                <div>
                  <select
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="title-asc">Tên truyện A → Z</option>
                    <option value="title-desc">Tên truyện Z → A</option>
                    <option value="author-asc">Tác giả A → Z</option>
                    <option value="author-desc">Tác giả Z → A</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* layout: sidebar + grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Sidebar genres */}
          <aside className="lg:col-span-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Danh mục
              </h2>

              <ul className="mt-3 space-y-2">
                {genres.map((g) => (
                  <li key={g}>
                    <button
                      onClick={() => handlePickGenre(g)}
                      className={
                        "flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-sm transition " +
                        (g === active
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100")
                      }
                    >
                      <span className="truncate">{g}</span>
                      <span
                        className={
                          "ml-2 inline-flex h-6 min-w-[2rem] items-center justify-center rounded-full px-2 text-xs " +
                          (g === active
                            ? "bg-white/15 text-white"
                            : "bg-white text-slate-600 border border-slate-200")
                        }
                      >
                        {counts[g] || 0}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Content grid */}
          <section className="lg:col-span-9">
            <div className="mb-4 text-sm text-slate-600">
              Thể loại:{" "}
              <span className="font-semibold text-slate-800">{active || "—"}</span> ·
              Tìm thấy{" "}
              <span className="font-semibold text-slate-800">{filtered.length}</span>{" "}
              truyện · Trang {page}/{totalPages}
            </div>

            {err && (
              <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 shadow-sm">
                {err}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: pageSize }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {paged.map((b) => (
                  <BookCard key={b.id} book={b} />
                ))}
              </div>
            )}

            {/* pagination */}
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
                  {BOOKS_PER_PAGE_OPTIONS.map((n) => (
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
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}