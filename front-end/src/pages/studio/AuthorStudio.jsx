import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { api, API_BASE } from "../../lib/api";

const pickArray = (res) =>
  Array.isArray(res) ? res : res?.items || res?.data || [];

function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem("sessionUser") || "null");
  } catch {
    return null;
  }
}

export default function AuthorStudio() {
  const [me, setMe] = useState(getSessionUser());
  const [loadingMe, setLoadingMe] = useState(!me);
  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [err, setErr] = useState("");
  const [expandedNovelId, setExpandedNovelId] = useState("");
  const [chaptersByNovel, setChaptersByNovel] = useState({});
  const [loadingChapters, setLoadingChapters] = useState({});

  useEffect(() => {
    if (me) return;

    let mounted = true;
    const base = API_BASE || window.location.origin;

    fetch(new URL("/api/auth/me", base), {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
      },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => mounted && setMe(u))
      .catch(() => {})
      .finally(() => mounted && setLoadingMe(false));

    return () => {
      mounted = false;
    };
  }, [me]);

  useEffect(() => {
    if (!me) {
      setBooks([]);
      setLoadingBooks(false);
      return;
    }

    let mounted = true;
    setLoadingBooks(true);

    const base = API_BASE || window.location.origin;
    const url = new URL("/api/novels", base);
    url.searchParams.set("authorId", me._id || me.id);

    fetch(url.toString())
      .then((r) => (r.ok ? r.json() : []))
      .then((res) => {
        if (!mounted) return;

        const arr = pickArray(res);
        const norm = arr.map((n) => ({
          id: n._id || n.id,
          title: n.title || "",
          cover: n.cover || n.image || "",
          description: n.description || "",
          genre: n.genre || "",
          status: n.status || "ongoing",
        }));

        setBooks(norm);
      })
      .catch((e) => setErr(e.message || "Lỗi tải tác phẩm"))
      .finally(() => mounted && setLoadingBooks(false));

    return () => {
      mounted = false;
    };
  }, [me]);

  const authorName = useMemo(() => me?.name || "Tôi", [me]);

  async function toggleChapters(novelId) {
    if (expandedNovelId === novelId) {
      setExpandedNovelId("");
      return;
    }

    setExpandedNovelId(novelId);

    if (chaptersByNovel[novelId]) return;

    setLoadingChapters((prev) => ({ ...prev, [novelId]: true }));

    try {
      const base = API_BASE || window.location.origin;
      const url = new URL("/api/chapters", base);
      url.searchParams.set("novelId", novelId);

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
        },
      });

      const data = res.ok ? await res.json() : [];

      setChaptersByNovel((prev) => ({
        ...prev,
        [novelId]: Array.isArray(data) ? data : [],
      }));
    } catch (e) {
      alert(e.message || "Không thể tải danh sách chương.");
    } finally {
      setLoadingChapters((prev) => ({ ...prev, [novelId]: false }));
    }
  }

  async function handleDeleteNovel(novelId) {
    if (
      !window.confirm(
        "Bạn có chắc muốn xóa tác phẩm này? Tất cả chương thuộc tác phẩm cũng sẽ bị xóa."
      )
    ) {
      return;
    }

    try {
      await api.studio.deleteNovel(novelId);
      setBooks((prev) => prev.filter((b) => b.id !== novelId));
      alert("Đã xóa tác phẩm.");
    } catch (e) {
      alert(e.message || "Không thể xóa tác phẩm.");
    }
  }

  async function handleDeleteChapter(novelId, chapterId) {
    if (!window.confirm("Bạn có chắc muốn xóa chương này?")) return;

    try {
      await api.studio.deleteChapter(chapterId);
      setChaptersByNovel((prev) => ({
        ...prev,
        [novelId]: (prev[novelId] || []).filter(
          (c) => String(c._id || c.id) !== String(chapterId)
        ),
      }));
      alert("Đã xóa chương.");
    } catch (e) {
      alert(e.message || "Không thể xóa chương.");
    }
  }

  return (
    <>
      <Header />

      <main className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-pink-50">
        <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          <div className="mb-6 rounded-3xl border border-purple-100 bg-white/80 p-5 shadow-sm backdrop-blur md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Studio sáng tác
                  </span>
                </h1>

                <p className="mt-2 text-sm text-gray-600">
                  Quản lý tác phẩm, thêm chương, chỉnh sửa và theo dõi nội dung
                  của bạn.
                </p>

                <div className="mt-3 inline-flex rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-sm text-gray-700">
                  Đăng nhập:&nbsp;
                  <b className="text-gray-900">
                    {loadingMe ? "Đang tải..." : authorName}
                  </b>
                </div>
              </div>

              <Link
                to="/studio/new"
                className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow transition hover:scale-[1.02] hover:shadow-md"
              >
                + Tạo tác phẩm mới
              </Link>
              <Link
                to="/studio/wallet"
                className="inline-flex items-center justify-center rounded-2xl border border-purple-200 bg-white px-5 py-3 text-sm font-semibold text-purple-700 shadow transition hover:bg-purple-50 hover:shadow-md"
              >
                Ví tác giả
              </Link>
            </div>
          </div>

          {err && (
            <div className="mb-5 rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3 text-sm text-pink-700">
              {err}
            </div>
          )}

          {loadingBooks ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse overflow-hidden rounded-3xl border border-purple-100 bg-white shadow-sm"
                >
                  <div className="h-56 bg-purple-100/70" />
                  <div className="space-y-3 p-4">
                    <div className="h-4 w-3/4 rounded bg-purple-100" />
                    <div className="h-3 w-full rounded bg-purple-100" />
                    <div className="h-3 w-2/3 rounded bg-purple-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : books.length === 0 ? (
            <div className="rounded-3xl border border-purple-200 bg-white p-10 text-center shadow-sm">
              <div className="text-4xl">📚</div>
              <h2 className="mt-3 text-xl font-bold text-gray-900">
                Chưa có tác phẩm nào
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Hãy nhấn <b>“Tạo tác phẩm mới”</b> để bắt đầu đăng truyện.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {books.map((b) => (
                <article
                  key={b.id}
                  className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-[170px_1fr]">
                    <Link
                      to={`/novel/${b.id}`}
                      className="block h-56 overflow-hidden bg-gray-100 sm:h-full"
                    >
                      <img
                        src={b.cover}
                        alt={b.title}
                        className="h-full w-full object-cover transition duration-300 hover:scale-105"
                      />
                    </Link>

                    <div className="flex min-h-[240px] flex-col p-4">
                      <div>
                        {b.genre && (
                          <span className="mb-2 inline-flex rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                            {b.genre}
                          </span>
                        )}
                        <span
                          className={`mb-2 ml-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            b.status === "completed"
                              ? "bg-green-50 text-green-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {b.status === "completed" ? "Đã hoàn thành" : "Đang tiến hành"}
                        </span>
                        <Link
                          to={`/novel/${b.id}`}
                          className="line-clamp-2 text-lg font-bold text-gray-900 hover:text-purple-600"
                          title={b.title}
                        >
                          {b.title}
                        </Link>

                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">
                          {b.description || "Chưa có mô tả cho tác phẩm này."}
                        </p>
                      </div>

                      <div className="mt-auto pt-4">
                        <div className="grid grid-cols-2 gap-2">
                          <Link
                            to={`/studio/novel/${b.id}/chapters/new`}
                            className="rounded-xl border border-gray-200 px-3 py-2 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                          >
                            + Thêm chương
                          </Link>

                          <Link
                            to={`/studio/novel/${b.id}/edit`}
                            className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-3 py-2 text-center text-sm font-medium text-white transition hover:opacity-90"
                          >
                            Sửa tác phẩm
                          </Link>

                          <button
                            onClick={() => toggleChapters(b.id)}
                            className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                          >
                            {expandedNovelId === b.id
                              ? "Ẩn chương"
                              : "Quản lý chương"}
                          </button>

                          <button
                            onClick={() => handleDeleteNovel(b.id)}
                            className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Xóa tác phẩm
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {expandedNovelId === b.id && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold text-gray-900">
                          Danh sách chương
                        </h3>

                        <Link
                          to={`/studio/novel/${b.id}/chapters/new`}
                          className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-purple-700 ring-1 ring-purple-100 transition hover:bg-purple-50"
                        >
                          + Thêm
                        </Link>
                      </div>

                      {loadingChapters[b.id] ? (
                        <div className="rounded-2xl bg-white p-4 text-sm text-gray-500">
                          Đang tải chương...
                        </div>
                      ) : (chaptersByNovel[b.id] || []).length === 0 ? (
                        <div className="rounded-2xl bg-white p-4 text-sm text-gray-500">
                          Chưa có chương nào.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(chaptersByNovel[b.id] || []).map((ch) => {
                            const chapterId = ch._id || ch.id;

                            return (
                            <div
                              key={chapterId}
                              className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <div className="line-clamp-1 text-sm font-semibold text-gray-900">
                                  Chương {ch.no}: {ch.title}
                                </div>

                                <div className="mt-1 text-xs text-gray-500">
                                  {ch.isPaid ? "Chương VIP" : "Miễn phí"}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-wrap gap-2">
                                <Link
                                  to={`/novel/${b.id}/chuong/${ch.no}`}
                                  className="rounded-lg border px-3 py-1.5 text-xs text-gray-700 transition hover:bg-gray-50"
                                >
                                  Xem
                                </Link>
            
                                <Link
                                  to={`/studio/novel/${b.id}/chapters/${chapterId}/edit`}
                                  className="rounded-lg border border-purple-200 px-3 py-1.5 text-xs text-purple-700 transition hover:bg-purple-50"
                                >
                                  Sửa
                                </Link>

                                <button
                                  onClick={() =>
                                    handleDeleteChapter(b.id, chapterId)
                                  }
                                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 transition hover:bg-red-50"
                                >
                                  Xóa
                                </button>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </>
  );
}