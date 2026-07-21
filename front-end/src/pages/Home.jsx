import React, { useCallback, useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { Link, useSearchParams } from "react-router-dom";
import { api, API_BASE } from "../lib/api";

import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/autoplay";
import { Autoplay } from "swiper/modules";

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(urlQuery);
  const [activeGenre, setActiveGenre] = useState("");

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const handleSearch = useCallback(
    (keyword) => {
      const value = String(keyword || "").trim();
      setQuery(value);
      setSearchParams(value ? { q: value } : {}, { replace: true });
    },
    [setSearchParams]
  );

  const [genres, setGenres] = useState([]);
  const [posters, setPosters] = useState([]);
  const [allNovels, setAllNovels] = useState([]);
  const [topReadNovels, setTopReadNovels] = useState([]);
  const [latestNovels, setLatestNovels] = useState([]);
  const [latestChapters, setLatestChapters] = useState([]);
  const [loadingLatestChapters, setLoadingLatestChapters] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [loadingGenres, setLoadingGenres] = useState(true);
  const [loadingNovels, setLoadingNovels] = useState(true);
  const [err, setErr] = useState("");

  const pickArray = (res) => {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.items)) return res.items;
    if (res && Array.isArray(res.data)) return res.data;
    return [];
  };

  useEffect(() => {
    let mounted = true;
    setErr("");

    Promise.all([api.getGenres(), api.getPosters()])
      .then(([genresRes, postersRes]) => {
        if (!mounted) return;

        const rawGenres = pickArray(genresRes);
        const normGenres = rawGenres
          .map((g) => (typeof g === "string" ? g : g?.name || g?.title || ""))
          .filter(Boolean);

        const rawPosters = pickArray(postersRes);
        const normPosters = rawPosters
          .map((p) => ({
            id: p._id || p.id || String(Math.random()),
            title: p.title || "",
            image: p.image || p.url || "",
            link: p.link || "/",
            order: p.order ?? 0,
          }))
          .sort((a, b) => a.order - b.order);

        setGenres(normGenres);
        setPosters(normPosters);
        setLoadingGenres(false);
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(e.message || "Lỗi tải dữ liệu");
        setLoadingGenres(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoadingNovels(true);
    setErr("");

    fetch(new URL("/api/novels", API_BASE || window.location.origin))
      .then((r) => r.json())
      .then((res) => {
        if (!mounted) return;
        const rows = pickArray(res);

        const norm = rows.map((n) => ({
          id: n._id || n.id,
          title: n.title || "",
          cover: n.cover || n.image || "",
          genre: n.genre || n.genreName || "",
          authorName:
            n.authorName ||
            (typeof n.author === "string" ? n.author : n?.author?.name) ||
            "",
        }));

        setAllNovels(norm);

        setGenres((prev) => {
          if (prev && prev.length) return prev;
          const s = Array.from(new Set(norm.map((x) => x.genre).filter(Boolean)));
          return s.sort((a, b) => a.localeCompare(b, "vi"));
        });
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(e.message || "Lỗi tải truyện");
      })
      .finally(() => setLoadingNovels(false));

    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    let mounted = true;
    setLoadingRanking(true);
  
    Promise.all([api.getTopReadNovels(), api.getLatestNovels()])
      .then(([topRes, latestRes]) => {
        if (!mounted) return;
  
        setTopReadNovels(pickArray(topRes));
        setLatestNovels(pickArray(latestRes));
      })
      .catch((e) => {
        console.error("[Home ranking] error:", e);
      })
      .finally(() => {
        if (mounted) setLoadingRanking(false);
      });
  
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    let mounted = true;
    setLoadingLatestChapters(true);
  
    api
      .getLatestChapterUpdates()
      .then((res) => {
        if (!mounted) return;
        setLatestChapters(pickArray(res));
      })
      .catch((e) => {
        console.error("[Home latest chapters] error:", e);
      })
      .finally(() => {
        if (mounted) setLoadingLatestChapters(false);
      });
  
    return () => {
      mounted = false;
    };
  }, []);
  const searchResults = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    if (!q) return [];

    return allNovels.filter((novel) =>
      [novel.title, novel.authorName, novel.genre]
        .map((value) => String(value || "").toLocaleLowerCase("vi"))
        .some((value) => value.includes(q))
    );
  }, [allNovels, query]);

  const byGenre = useMemo(() => {
    const q = query.trim().toLowerCase();

    const src = q
      ? allNovels.filter(
          (n) =>
            n.title.toLowerCase().includes(q) ||
            n.authorName.toLowerCase().includes(q) ||
            n.genre.toLowerCase().includes(q)
        )
      : allNovels;

    const grouped = src.reduce((m, n) => {
      const g = n.genre || "Khác";
      if (!m[g]) m[g] = [];
      m[g].push(n);
      return m;
    }, {});

    const ordered = {};
    (genres.length ? genres : Object.keys(grouped)).forEach((g) => {
      const list = grouped[g] || [];
      ordered[g] = q ? list : list.slice(0, 5);
    });

    return ordered;
  }, [allNovels, genres, query]);

  const visibleGenres = useMemo(() => {
    const baseGenres = genres.length ? genres : Object.keys(byGenre);
    if (activeGenre) return baseGenres.filter((g) => g === activeGenre);
    return baseGenres;
  }, [genres, byGenre, activeGenre]);


  return (
    <>
      <Header onSearch={handleSearch} />

      <main className="min-h-screen bg-slate-100 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
          {/* Hero / Slider */}
          {!query.trim() && (
          <section className="rounded-3xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
            <Swiper
              spaceBetween={20}
              slidesPerView={1}
              autoplay={{ delay: 3000, disableOnInteraction: false }}
              loop
              modules={[Autoplay]}
              className="rounded-2xl overflow-hidden"
            >
              {(posters || []).map((poster) => (
                <SwiperSlide key={poster.id}>
                  <Link to={poster.link || "/"} className="block relative group">
                    <img
                      src={poster.image}
                      alt={poster.title}
                      className="w-full h-64 sm:h-72 lg:h-80 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-900/40 to-transparent" />
                    <div className="absolute inset-0 flex items-end sm:items-center px-5 sm:px-8 py-6">
                      <div className="max-w-2xl">
                        <span className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-xs font-medium tracking-wide text-slate-100 backdrop-blur-sm border border-white/10">
                          NỔI BẬT
                        </span>
                        <h2 className="mt-3 text-xl sm:text-3xl font-semibold text-white drop-shadow-md">
                          {poster.title}
                        </h2>
                      </div>
                    </div>
                  </Link>
                </SwiperSlide>
              ))}
            </Swiper>
          </section>
          )}
          {/* Ranking + Latest */}
          {!query.trim() && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RankingBox
              title="Top 10 truyện đọc nhiều nhất"
              icon="🔥"
              items={topReadNovels}
              loading={loadingRanking}
              type="views"
            />

            <RankingBox
              title="Truyện mới ra mắt"
              icon="✨"
              items={latestNovels}
              loading={loadingRanking}
              type="latest"
            />
          </section>
          )}
          {/* Latest chapter updates */}
          {!query.trim() && (
            <LatestChapterUpdates
              items={latestChapters}
              loading={loadingLatestChapters}
            />
          )}

          {query.trim() && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">
                    Kết quả tìm kiếm
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Từ khóa “{query}” · {searchResults.length} kết quả
                  </p>
                </div>
              </div>

              {loadingNovels ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  Đang tìm truyện...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
                  Không tìm thấy kết quả cho từ khóa “{query}”.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {searchResults.map((novel) => (
                    <Link
                      key={novel.id}
                      to={`/novel/${novel.id}`}
                      className="group block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md"
                    >
                      <div className="overflow-hidden rounded-xl bg-slate-100">
                        <img
                          src={novel.cover}
                          alt={novel.title}
                          className="h-64 w-full object-cover transition duration-300 group-hover:scale-[1.02] sm:h-72"
                        />
                      </div>
                      <p className="mt-3 line-clamp-2 text-base font-semibold text-slate-800">
                        {novel.title}
                      </p>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {novel.authorName || "Chưa rõ tác giả"}
                      </p>
                      <p className="mt-1 truncate text-xs font-medium text-slate-600">
                        {novel.genre || "Chưa có thể loại"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Genre filter horizontal */}
          {!query.trim() && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                <h3 className="text-xl font-bold uppercase tracking-wide text-slate-800">
                  Thể loại truyện
                </h3>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveGenre("")}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    activeGenre === ""
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400 hover:bg-slate-100"
                  }`}
                >
                  Tất cả
                </button>

                {visibleGenres.length > 0 || genres.length > 0
                  ? (genres.length ? genres : Object.keys(byGenre)).map((genre) => (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => setActiveGenre(genre)}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                          activeGenre === genre
                            ? "border-slate-800 bg-slate-800 text-white"
                            : "border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400 hover:bg-slate-100"
                        }`}
                      >
                        {genre}
                      </button>
                    ))
                  : null}
              </div>
            </section>
          )}

          {err && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 shadow-sm">
              {err}
            </div>
          )}

          <div className="space-y-6">
            {loadingGenres && (
              <div className="grid grid-cols-1 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"
                  >
                    <div className="animate-pulse">
                      <div className="h-6 w-48 bg-slate-200 rounded mb-4" />
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <div
                            key={j}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <div className="h-64 rounded-xl bg-slate-200/80" />
                            <div className="mt-3 h-4 w-3/4 rounded bg-slate-200/80" />
                            <div className="mt-2 h-3 w-1/2 rounded bg-slate-200/80" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!query.trim() &&
              !loadingGenres &&
              visibleGenres.map((genre) => {
                const list = byGenre[genre] || [];
                if (query.trim() && list.length === 0) return null;

                return (
                  <section
                    key={genre}
                    className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm"
                  >
                    <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                        <h3 className="text-lg sm:text-xl font-semibold text-slate-800">
                          {genre}
                          <span className="ml-2 text-sm font-normal text-slate-500">
                            ({list.length})
                          </span>
                        </h3>
                      </div>

                      {!query.trim() && (
                        <Link
                          to={`/category/${encodeURIComponent(genre)}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition"
                        >
                          Xem tất cả
                          <span aria-hidden="true">→</span>
                        </Link>
                      )}
                    </div>

                    {loadingNovels && !query.trim() && (!list || list.length === 0) ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 animate-pulse">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <div
                            key={j}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <div className="h-64 rounded-xl bg-slate-200/80" />
                            <div className="mt-3 h-4 w-3/4 rounded bg-slate-200/80" />
                            <div className="mt-2 h-3 w-1/2 rounded bg-slate-200/80" />
                          </div>
                        ))}
                      </div>
                    ) : list.length === 0 ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
                        Không có truyện phù hợp trong “{genre}”.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                        {list.map((novel) => (
                          <Link
                            key={novel.id}
                            to={`/novel/${novel.id}`}
                            className="group block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm hover:-translate-y-1 hover:shadow-md transition duration-300"
                          >
                            <div className="overflow-hidden rounded-xl bg-slate-100">
                              <img
                                src={novel.cover}
                                alt={novel.title}
                                className="h-64 sm:h-72 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                              />
                            </div>

                            <p className="mt-3 line-clamp-2 text-base font-semibold text-slate-800">
                              {novel.title}
                            </p>
                            <p className="mt-1 truncate text-sm text-slate-500">
                              {novel.authorName || ""}
                            </p>
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
              

            {!loadingGenres && !query.trim() && activeGenre && (byGenre[activeGenre] || []).length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
                Không có truyện trong thể loại “{activeGenre}”.
              </div>
            )}

          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
function RankingBox({ title, icon, items, loading, type }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">
          {icon} {title}
        </h3>
      </div>

      <div className="divide-y divide-slate-100">
        {loading && (
          <div className="p-5 text-sm text-slate-500">Đang tải...</div>
        )}

        {!loading && (!items || items.length === 0) && (
          <div className="p-5 text-sm text-slate-500">Chưa có dữ liệu.</div>
        )}

        {!loading &&
          items?.slice(0, 10).map((novel, index) => {
            const id = novel.id || novel._id;
            const rank = index + 1;

            return (
              <Link
                key={id || index}
                to={`/novel/${id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                    rank <= 3
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {rank}
                </div>

                <img
                  src={novel.cover || novel.image || ""}
                  alt={novel.title}
                  className="w-12 h-16 rounded-lg object-cover bg-slate-100 border border-slate-100"
                />

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 line-clamp-1">
                    {novel.title}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {type === "views" ? (
                      <span className="text-red-500 font-medium">
                        🔥 {Number(novel.views || 0).toLocaleString("vi-VN")} lượt đọc
                      </span>
                    ) : (
                      <span>
                        {novel.genre || "Chưa có thể loại"}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
}
function LatestChapterUpdates({ items, loading }) {
  function timeAgo(value) {
    if (!value) return "";
    const diff = Date.now() - new Date(value).getTime();
    if (Number.isNaN(diff)) return "";

    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "vừa xong";
    if (minutes < 60) return `${minutes} phút trước`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;

    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-xl sm:text-xl font-bold text-slate-800">
          🔄 CHƯƠNG MỚI CẬP NHẬT
        </h3>
      </div>

      <div className="divide-y divide-dashed divide-slate-200">
        {loading && (
          <div className="px-5 py-5 text-sm text-slate-500">Đang tải...</div>
        )}

        {!loading && (!items || items.length === 0) && (
          <div className="px-5 py-5 text-sm text-slate-500">
            Chưa có chương mới cập nhật.
          </div>
        )}

        {!loading &&
          items?.slice(0, 10).map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-1 md:grid-cols-[180px_1fr_1fr_120px] gap-2 md:gap-4 px-5 py-4 items-center hover:bg-slate-50 transition"
            >
              <div className="text-green-700 font-bold text-sm uppercase">
                [{item.genre || "Khác"}]
              </div>

              <Link
                to={`/novel/${item.novelId}`}
                className="font-bold text-slate-800 hover:underline line-clamp-1"
              >
                {item.novelTitle || "Không rõ truyện"}
              </Link>

              <Link
                to={`/novel/${item.novelId}/chuong/${item.chapterNo || 1}`}
                className="text-slate-900 hover:underline line-clamp-1"
              >
                {item.chapterTitle || `Chương ${item.chapterNo || ""}`}
              </Link>

              <div className="text-sm text-slate-500 md:text-right">
                {timeAgo(item.updatedAt)}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}