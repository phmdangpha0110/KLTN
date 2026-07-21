// front-end/src/pages/Authors.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function Authors() {
  const [authors, setAuthors] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAuthors();
  }, []);

  async function loadAuthors(page = 1) {
    try {
      setLoading(true);
      const data = await api.authors.list({ page });
      setAuthors(data.items || []);
      setPagination(data.pagination || null);
    } catch (err) {
      console.error("Load authors error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />

      <div className="min-h-screen bg-slate-100 py-6 sm:py-8">
        <div className="mx-auto max-w-6xl px-4 space-y-6">
          {/* Title block */}
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl">
                  Danh sách tác giả
                </h1>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 sm:text-sm">
                {pagination && (
                  <>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5">
                      Trang{" "}
                      <span className="font-semibold text-slate-800">
                        {pagination.page}
                      </span>{" "}
                      / {pagination.totalPages}
                    </span>
                    <span className="hidden sm:inline text-slate-300">•</span>
                    <span className="hidden sm:inline rounded-full bg-slate-100 px-3 py-1.5">
                      Tổng{" "}
                      <span className="font-semibold text-slate-800">
                        {pagination.total}
                      </span>{" "}
                      tác giả
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Loading / empty state */}
          {loading && (
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-12 shadow-sm">
              <div className="flex items-center justify-center gap-3 text-slate-600">
                <span className="inline-block h-5 w-5 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
                <span className="text-sm sm:text-base">
                  Đang tải danh sách tác giả...
                </span>
              </div>
            </div>
          )}

          {!loading && authors.length === 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">
              Hiện chưa có tác giả nào.
            </div>
          )}

          {/* Grid tác giả */}
          {authors.length > 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-5 sm:py-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
                {authors.map((a) => (
                  <div
                    key={a._id}
                    className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-slate-50 via-white to-slate-100" />

                    <div className="relative flex flex-col items-center">
                      <div className="relative mb-4">
                        <div className="absolute inset-0 scale-110 rounded-full bg-gradient-to-br from-slate-200 to-slate-100 opacity-70 blur-md" />
                        <img
                          src={a.avatar || "https://via.placeholder.com/120"}
                          alt={a.name}
                          className="relative h-24 w-24 rounded-full object-cover ring-4 ring-white shadow-md"
                        />
                        <div className="absolute -bottom-1 -right-1 rounded-full border border-white bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow">
                          {a.worksCount || 0} TP
                        </div>
                      </div>

                      <h2 className="line-clamp-2 text-center text-lg font-semibold tracking-tight text-slate-800">
                        {a.name}
                      </h2>


                      

                      <div className="mt-4 grid w-full grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                          <div className="text-xs text-slate-500">Tác phẩm</div>
                          <div className="mt-1 text-sm font-semibold text-slate-800">
                            {a.worksCount || 0}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                          <div className="text-xs text-slate-500">Theo dõi</div>
                          <div className="mt-1 text-sm font-semibold text-slate-800">
                            {a.followersCount || 0}
                          </div>
                        </div>
                      </div>

                      <Link
                        to={`/author/${a._id}`}
                        className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-indigo-700 hover:text-white hover:scale-[1.04] hover:shadow-xl"
                      >
                        Xem chi tiết
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {Array.from(
                { length: pagination.totalPages },
                (_, i) => i + 1
              ).map((p) => (
                <button
                  key={p}
                  onClick={() => loadAuthors(p)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                    p === pagination.page
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}