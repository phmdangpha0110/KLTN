// src/pages/Favorites.jsx
import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { api, API_BASE } from "../lib/api";
import {
  getFavoriteIds,
  removeFavorite as removeFavUtil,
  ensureFavoriteMapLoaded,
} from "../utils/favorites";

// lấy user hiện tại từ localStorage (đã được set khi login)
function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem("sessionUser") || "null");
  } catch {
    return null;
  }
}
const getUserId = () => {
  const u = getSessionUser();
  return (u && (u._id || u.id)) || null;
};

// Chuẩn hoá novel về format UI cũ
const normalizeNovel = (n) => ({
  id: String(n?._id || n?.id || ""),
  title: n?.title || "",
  cover: n?.cover || n?.image || "",
  author:
    n?.authorName ||
    (typeof n?.author === "string" ? n?.author : n?.author?.name) ||
    "",
  description: n?.description || "",
});

export default function Favorites() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [allNovels, setAllNovels] = useState([]); // novels từ API (đã chuẩn hoá)
  const [favIds, setFavIds] = useState([]); // string[]

  // ---- 1) Tải toàn bộ novels từ API (1 lần) ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      setErr("");
      try {
        const url = new URL("/api/novels", API_BASE || window.location.origin);
        const res = await fetch(url.toString());
        const raw = await res.json().catch(() => []);
        const arr = Array.isArray(raw) ? raw : raw?.items || raw?.data || [];
        if (mounted) setAllNovels(arr.map(normalizeNovel).filter((x) => x.id));
      } catch (e) {
        if (mounted) setErr(e?.message || "Lỗi tải truyện.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ---- 2) Lấy danh sách yêu thích từ API (ưu tiên), fallback local ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const uid = getUserId();
        let favList = [];
        try {
          // Nếu đã đăng nhập (có token) thì GET /api/favorites
          // Nếu chưa, fallback thêm ?userId= để backend dev-friendly
          const url = new URL("/api/favorites", API_BASE || window.location.origin);
          if (uid) url.searchParams.set("userId", uid);
          const res = await fetch(url.toString(), {
            headers: { "Content-Type": "application/json" },
          });
          const data = await res.json().catch(() => []);
          favList = Array.isArray(data) ? data : data?.items || data?.data || [];
        } catch {
          favList = [];
        }
        if (favList.length > 0) {
          const ids = favList
            .map((f) => String(f.novelId || f.novel?._id || f.novel?.id || ""))
            .filter(Boolean);
          if (mounted) setFavIds(ids);
        } else {
          // fallback localStorage
          if (mounted) setFavIds(getFavoriteIds().map(String));
        }
      } catch {
        if (mounted) setFavIds(getFavoriteIds().map(String));
      }
    })();
    // đồng bộ map để có thể xoá theo favoriteId nếu server cần
    ensureFavoriteMapLoaded();
    return () => {
      mounted = false;
    };
  }, []);

  // ---- 3) lắng nghe thay đổi localStorage (key theo user) ----
  useEffect(() => {
    const onStorage = (e) => {
      if (!e.key) return;
      if (e.key.startsWith("dkstory_favorites_v1")) {
        setFavIds(getFavoriteIds().map(String));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ---- 4) map id -> novel ----
  const novelMap = useMemo(() => {
    const m = new Map();
    allNovels.forEach((n) => m.set(String(n.id), n));
    return m;
  }, [allNovels]);

  const items = useMemo(() => {
    const set = new Set(favIds.map(String));
    return Array.from(set).map((id) => novelMap.get(id)).filter(Boolean);
  }, [favIds, novelMap]);

  // ---- 5) Bỏ ❤️ ----
  const handleRemove = async (id) => {
    const sId = String(id);
    // Optimistic UI
    setFavIds((prev) => prev.filter((x) => x !== sId));
    try {
      await removeFavUtil(sId); // utils đã lo API + fallback
    } finally {
      // đồng bộ lại từ local sau khi utils cập nhật
      setFavIds(getFavoriteIds().map(String));
    }
  };

  return (
    <>
      <Header favCount={favIds.length} />

      <main className="min-h-screen bg-slate-100 py-8">
        <div className="max-w-6xl mx-auto px-6">
          {/* Header block */}
          <div className="mb-6 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-800">
                  Truyện yêu thích
                </h1>
              </div>

              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                Tổng:{" "}
                <span className="font-semibold text-slate-800">
                  {items.length}
                </span>{" "}
                truyện
              </div>
            </div>
          </div>

          {err && (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 shadow-sm">
              {err}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="h-56 w-full rounded-2xl bg-slate-200/80" />
                  <div className="mt-3 space-y-2">
                    <div className="h-4 w-4/5 rounded bg-slate-200/80" />
                    <div className="h-3 w-2/5 rounded bg-slate-200/80" />
                    <div className="h-3 w-full rounded bg-slate-200/80" />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <div className="h-9 flex-1 rounded-xl bg-slate-200/80" />
                    <div className="h-9 w-24 rounded-xl bg-slate-200/80" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <div className="mb-3 text-4xl">🤍</div>
              <h2 className="text-lg font-semibold text-slate-800 mb-2">
                Chưa có truyện nào trong danh sách yêu thích
              </h2>
              <p className="text-slate-600 mb-5">
                Hãy vào trang chi tiết truyện và bấm{" "}
                <span className="font-medium">“Thêm vào yêu thích”</span>.
              </p>
              <Link
                to="/home"
                className="inline-flex items-center rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 hover:text-white hover:scale-[1.04] hover:shadow-xl"
              >
                Khám phá truyện
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((b) => (
                <div
                  key={b.id}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md"
                >
                  {/* Giữ nguyên đường dẫn UI cũ */}
                  <Link to={`/detail/${b.id}`} className="block overflow-hidden">
                    <img
                      src={b.cover}
                      alt={b.title}
                      className="h-56 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  </Link>

                  <div className="flex flex-1 flex-col p-4">
                    <Link
                      to={`/detail/${b.id}`}
                      className="line-clamp-2 text-base font-semibold text-slate-800 transition hover:text-slate-950"
                    >
                      {b.title}
                    </Link>

                    <div className="mt-1 line-clamp-1 text-sm text-slate-500">
                      {b.author}
                    </div>

                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                      {b.description}
                    </p>

                    <div className="mt-auto pt-4 flex items-center justify-between gap-2">
                      <Link
                        to={`/novel/${b.id}/chuong/1`}
                        className="inline-flex items-center rounded-2xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 hover:text-white hover:scale-[1.04] hover:shadow-xl"
                      >
                        Đọc ngay
                      </Link>

                      <button
                        onClick={() => handleRemove(b.id)}
                        className="rounded-2xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                        title="Bỏ khỏi yêu thích"
                      >
                        Bỏ ❤️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}