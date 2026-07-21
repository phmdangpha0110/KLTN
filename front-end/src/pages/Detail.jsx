import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { API_BASE } from "../lib/api";
import {
  isFavorite,
  toggleFavorite,
  ensureFavoriteMapLoaded,
} from "../utils/favorites";

const ANONYMOUS_NAME = "Người dùng ẩn danh";

const getSessionUser = () => {
  try {
    return JSON.parse(localStorage.getItem("sessionUser") || "null");
  } catch {
    return null;
  }
};

const getDisplayName = (u) =>
  u?.name || u?.fullname || u?.username || u?.email || "Người dùng";

const getOrCreateCommentOwnerId = () => {
  const key = localStorage.getItem("comment-owner-id");
  if (key) return key;
  const newKey = "local-" + Math.random().toString(36).slice(2, 10);
  localStorage.setItem("comment-owner-id", newKey);
  return newKey;
};

const loadUserReports = () => {
  try {
    return JSON.parse(localStorage.getItem("userReports") || "[]");
  } catch {
    return [];
  }
};

const saveUserReports = (arr) =>
  localStorage.setItem("userReports", JSON.stringify(arr));

function useClickOutside(ref, onClose) {
  useEffect(() => {
    const fn = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [ref, onClose]);
}

export default function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [genreName, setGenreName] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [chapters, setChapters] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [fav, setFav] = useState(false);

  const [commentsState, setCommentsState] = useState([]);
  const [newComment, setNewComment] = useState("");
  const sessionUser = useMemo(() => getSessionUser(), []);
  const commentOwnerKey = useMemo(() => getOrCreateCommentOwnerId(), []);
  const [commentIdentity, setCommentIdentity] = useState(() => {
    const saved = localStorage.getItem("comment-identity");
    return saved === "named" ? "named" : "anonymous";
  });

  const commentDisplayName = useMemo(
    () => getDisplayName(sessionUser),
    [sessionUser]
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setMenuOpen(false));

  const [openReportNovel, setOpenReportNovel] = useState(false);
  const [novelReportType, setNovelReportType] = useState(
    "Nội dung không phù hợp"
  );
  const [novelReportText, setNovelReportText] = useState("");
  const [novelReportFiles, setNovelReportFiles] = useState([]);
  const [sendingNovel, setSendingNovel] = useState(false);
  const [novelErrors, setNovelErrors] = useState({});

  const resetNovelForm = () => {
    setNovelReportType("Nội dung không phù hợp");
    setNovelReportText("");
    setNovelReportFiles([]);
    setNovelErrors({});
  };

  const onPickNovelFiles = (e) => {
    const files = Array.from(e.target.files || []);

    files.forEach((file) => {
      const reader = new FileReader();

      reader.onload = () =>
        setNovelReportFiles((prev) => [
          ...prev,
          { name: file.name, url: reader.result },
        ]);

      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const removeNovelFile = (name) =>
    setNovelReportFiles((prev) => prev.filter((f) => f.name !== name));

  const validateNovelReport = () => {
    const err = {};

    if (!novelReportText.trim() || novelReportText.trim().length < 10) {
      err.text = "Vui lòng mô tả tối thiểu 10 ký tự.";
    }

    setNovelErrors(err);

    return Object.keys(err).length === 0;
  };

  const submitNovelReport = async () => {
    if (!validateNovelReport()) return;

    setSendingNovel(true);

    try {
      const payload = {
        id: `UR-${Date.now()}`,
        type: "Nội dung truyện",
        target: `"${book?.title}" (ID: ${id})`,
        reason: `${novelReportType} – ${novelReportText.trim()}`,
        attachments: novelReportFiles,
        createdAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        status: "pending",
      };

      const list = loadUserReports();

      list.unshift(payload);
      saveUserReports(list);

      alert("Đã gửi báo cáo truyện tới admin (demo). Cảm ơn bạn!");
      setOpenReportNovel(false);
      resetNovelForm();
    } catch (e) {
      console.error(e);
      alert("Gửi báo cáo thất bại. Vui lòng thử lại.");
    } finally {
      setSendingNovel(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setErr("");

    const url = new URL(`/api/novels/${id}`, API_BASE || window.location.origin);

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(async (n) => {
        if (!mounted) return;

        const norm = {
          id: n._id || n.id || id,
          title: n.title || "",
          cover: n.cover || n.image || "",
          genre: n.genre || n.genreName || "",
          authorName:
            n.authorName ||
            (typeof n.author === "string" ? n.author : n?.author?.name) ||
            "",
          description: n.description || "",
          chaptersCount: n.chaptersCount || 0,
          status: n.status || "ongoing",
        };

        setBook(norm);
        setGenreName(norm.genre);

        try {
          const chapterUrl = new URL(
            `/api/chapters?novelId=${norm.id}`,
            API_BASE || window.location.origin
          );

          const chapterRes = await fetch(chapterUrl).then((r) =>
            r.ok ? r.json() : []
          );

          const chapterArr = Array.isArray(chapterRes) ? chapterRes : [];

          setChapters(
            chapterArr
              .map((c) => ({
                id: c._id || c.id,
                no: c.no,
                title: c.title || "",
                isPaid: Boolean(c.isPaid),
                locked: Boolean(c.locked),
              }))
              .sort((a, b) => Number(a.no) - Number(b.no))
          );
        } catch {
          setChapters([]);
        }

        const local = localStorage.getItem(`comments-${norm.id}`);
        setCommentsState(local ? JSON.parse(local) : []);

        try {
          await ensureFavoriteMapLoaded();
          setFav(isFavorite(norm.id));
        } catch (e) {
          console.warn("ensureFavoriteMapLoaded fail:", e);
        }

        if (norm.genre) {
          const sUrl = new URL(`/api/novels`, API_BASE || window.location.origin);
          sUrl.searchParams.set("genre", norm.genre);
          sUrl.searchParams.set("limit", "8");

          const sRes = await fetch(sUrl)
            .then((r) => r.json())
            .catch(() => []);

          const sArr = Array.isArray(sRes)
            ? sRes
            : Array.isArray(sRes?.items)
            ? sRes.items
            : [];

          const sug = sArr
            .map((x) => ({
              id: x._id || x.id,
              title: x.title || "",
              cover: x.cover || x.image || "",
              authorName:
                x.authorName ||
                (typeof x.author === "string" ? x.author : x?.author?.name) ||
                "",
            }))
            .filter((x) => String(x.id) !== String(norm.id));

          setSuggestions(sug.slice(0, 8));
        } else {
          setSuggestions([]);
        }
      })
      .catch((e) => {
        if (!mounted) return;

        console.error(e);
        setErr("Không tải được dữ liệu truyện.");
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [id]);

  const handleReadNow = () => navigate(`/novel/${id}/chuong/1`);

  const handleToggleFav = async () => {
    try {
      const next = await toggleFavorite(id);
      setFav(next);
    } catch (e) {
      alert(e.message || "Không thể cập nhật yêu thích.");
    }
  };

  useEffect(() => {
    localStorage.setItem("comment-identity", commentIdentity);
  }, [commentIdentity]);

  const resolveCommentName = (c) => {
    if (c.isAnonymous) return ANONYMOUS_NAME;
    return c.user || c.userName || "Người dùng";
  };

  const canDeleteComment = (c) => {
    const uid = sessionUser?._id || sessionUser?.id;

    if (uid && c?.userId && String(c.userId) === String(uid)) return true;
    if (c?.ownerKey && c.ownerKey === commentOwnerKey) return true;

    return false;
  };

  const handleDeleteComment = (commentId) => {
    setCommentsState((prev) => {
      const next = prev.filter((c) => c.id !== commentId);
      localStorage.setItem(`comments-${id}`, JSON.stringify(next));
      return next;
    });
  };

  if (loading) {
    return (
      <>
        <Header />

        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="space-y-6 animate-pulse">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid md:grid-cols-[280px_1fr] gap-8">
                <div className="h-[380px] rounded-2xl bg-slate-200/80" />

                <div className="space-y-4">
                  <div className="h-8 w-2/3 rounded bg-slate-200/80" />
                  <div className="h-4 w-1/3 rounded bg-slate-200/80" />
                  <div className="h-24 rounded bg-slate-200/80" />

                  <div className="flex gap-3">
                    <div className="h-11 w-32 rounded-2xl bg-slate-200/80" />
                    <div className="h-11 w-40 rounded-2xl bg-slate-200/80" />
                    <div className="h-11 w-28 rounded-2xl bg-slate-200/80" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="h-6 w-48 rounded bg-slate-200/80 mb-4" />

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-52 rounded-2xl bg-slate-200/80" />
                    <div className="h-4 rounded bg-slate-200/80" />
                    <div className="h-3 w-2/3 rounded bg-slate-200/80" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </>
    );
  }

  if (err || !book) {
    return (
      <>
        <Header />

        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-800 mb-4">
              {err || "Truyện không tồn tại"}
            </h1>

            <Link
              to="/home"
              className="inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              ← Quay lại trang chủ
            </Link>
          </div>
        </div>

        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Hero detail */}
        <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div ref={menuRef} className="absolute right-4 top-4">
            <div className="relative">
              <button
                aria-label="More options"
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-slate-700 transition hover:bg-slate-50"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute left-1/2 top-[calc(100%+10px)] z-20 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-0 w-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white" />

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setOpenReportNovel(true);
                    }}
                    className="w-full px-4 py-4 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    🚩 Báo cáo truyện
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-[280px_1fr] gap-8">
            <div className="flex justify-center md:justify-start">
              <img
                src={book.cover}
                alt={book.title}
                className="w-64 h-auto rounded-2xl border border-slate-200 object-cover shadow-sm transition duration-300 hover:scale-[1.02]"
              />
            </div>

            <div className="flex flex-col justify-center">
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-800 leading-tight">
                {book.title}
              </h1>

              <div className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
                <p>
                  <span className="font-medium text-slate-800">Tác giả:</span>{" "}
                  {book.authorName}
                </p>

                <p>
                  <span className="font-medium text-slate-800">Thể loại:</span>{" "}
                  <Link
                    to={`/category/${encodeURIComponent(genreName || "")}`}
                    className="font-medium text-slate-700 transition hover:text-slate-950 hover:underline"
                  >
                    {genreName || "Khác"}
                  </Link>
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">
                    Tình trạng:
                  </span>

                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      book.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {book.status === "completed"
                      ? "Đã hoàn thành"
                      : "Đang tiến hành"}
                  </span>
                </p>
                <p>
                  <span className="font-medium text-slate-800">Số chương:</span>{" "}
                  {book.chaptersCount || chapters.length || 0}
                </p>
              </div>

              <div className="text-sm text-slate-600 leading-7">
                <span className="font-medium text-slate-800">Mô tả:</span>{" "}
                <span className="whitespace-pre-line">
                  {book.description || "Chưa có mô tả."}
                </span>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  className="rounded-2xl bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 hover:text-white hover:scale-[1.04] hover:shadow-xl"
                  onClick={handleReadNow}
                >
                  Đọc ngay
                </button>

                <button
                  onClick={handleToggleFav}
                  aria-pressed={fav}
                  title={fav ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
                  className={`rounded-2xl border px-6 py-2.5 text-sm font-medium transition ${
                    fav
                      ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {fav ? "Đang yêu thích ❤️" : "Thêm vào yêu thích 🤍"}
                </button>

                <Link
                  to="/home"
                  className="rounded-2xl border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  ← Quay lại
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Danh sách chương */}
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-800">
              Danh sách chương
            </h2>

            <span className="text-sm text-slate-500">
              Tổng: {chapters.length} chương
            </span>
          </div>

          {chapters.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
              Chưa có chương nào.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {chapters.map((chapter) => (
                <Link
                  key={chapter.id || chapter.no}
                  to={`/novel/${id}/chuong/${chapter.no}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-slate-50 transition"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 line-clamp-1">
                      Chương {chapter.no}: {chapter.title || "Không tiêu đề"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {chapter.isPaid && (
                      <span className="rounded-full bg-white-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                        
                      </span>
                    )}

                    {chapter.locked && (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                        VIP
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-800 mb-6">
              Gợi ý truyện cùng thể loại
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
              {suggestions.slice(0, 4).map((s) => (
                <Link
                  key={s.id}
                  to={`/novel/${s.id}`}
                  className="group rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md"
                >
                  <img
                    src={s.cover}
                    alt={s.title}
                    className="w-full h-52 object-cover rounded-xl"
                  />

                  <p className="mt-3 text-sm font-semibold text-slate-800 line-clamp-2">
                    {s.title}
                  </p>

                  <p className="text-xs text-slate-500 mt-1">
                    {s.authorName || ""}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-800 mb-5">
            Bình luận
          </h2>

          {commentsState.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
              Chưa có bình luận nào. Hãy là người đầu tiên!
            </div>
          ) : (
            <ul className="space-y-4">
              {commentsState.map((c) => (
                <li
                  key={c.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 flex items-start gap-3"
                >
                  <img
                    src={
                      c.avatar ||
                      c.userAvatar ||
                      `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(
                        resolveCommentName(c)
                      )}`
                    }
                    alt={resolveCommentName(c)}
                    className="h-10 w-10 rounded-xl border border-slate-200 object-cover"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-slate-800">
                          {resolveCommentName(c)}
                        </div>

                        <div className="text-xs text-slate-400">
                          {c.createdAt}
                        </div>
                      </div>

                      {canDeleteComment(c) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-xs font-medium text-rose-600 transition hover:text-rose-700"
                        >
                          Xóa
                        </button>
                      )}
                    </div>

                    <div className="mt-2 text-slate-700 whitespace-pre-wrap leading-7">
                      {c.content}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 border-t border-slate-200 pt-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">
              Thêm bình luận
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();

                if (!newComment.trim()) {
                  alert("Vui lòng nhập nội dung bình luận.");
                  return;
                }

                const now = new Date();
                const isAnonymous = commentIdentity !== "named";
                const displayName = isAnonymous
                  ? ANONYMOUS_NAME
                  : commentDisplayName;

                const avatar =
                  !isAnonymous && sessionUser?.avatar
                    ? sessionUser.avatar
                    : `https://api.dicebear.com/7.x/thumbs/svg?seed=${
                        isAnonymous
                          ? "anon-" + now.getTime()
                          : encodeURIComponent(displayName || "user")
                      }`;

                const newData = {
                  id: "cmt-" + now.getTime(),
                  user: displayName,
                  userId: sessionUser?._id || sessionUser?.id,
                  ownerKey: commentOwnerKey,
                  avatar,
                  isAnonymous,
                  content: newComment.trim(),
                  createdAt: now.toISOString().slice(0, 16).replace("T", " "),
                };

                const updated = [...commentsState, newData];

                setCommentsState(updated);
                setNewComment("");
                localStorage.setItem(`comments-${id}`, JSON.stringify(updated));
              }}
              className="space-y-4"
            >
              <textarea
                rows={4}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Chia sẻ cảm nghĩ của bạn về truyện này..."
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-600">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="comment-identity"
                      value="named"
                      checked={commentIdentity === "named"}
                      onChange={() => setCommentIdentity("named")}
                      className="text-slate-700 focus:ring-slate-400"
                    />

                    <span>
                      Hiển thị tên:{" "}
                      <span className="font-medium text-slate-800">
                        {commentDisplayName}
                      </span>
                    </span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="comment-identity"
                      value="anonymous"
                      checked={commentIdentity === "anonymous"}
                      onChange={() => setCommentIdentity("anonymous")}
                      className="text-slate-700 focus:ring-slate-400"
                    />

                    <span>Ẩn danh</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 hover:text-white hover:scale-[1.04] hover:shadow-xl"
                >
                  Gửi bình luận
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <Footer />

      <div
        className={`fixed inset-0 z-50 ${
          openReportNovel ? "" : "pointer-events-none"
        }`}
      >
        <div
          onClick={() => setOpenReportNovel(false)}
          className={
            "absolute inset-0 bg-black/40 transition-opacity " +
            (openReportNovel ? "opacity-100" : "opacity-0")
          }
        />

        <div
          className={
            "absolute left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 transform rounded-3xl border border-slate-200 bg-white shadow-2xl transition " +
            (openReportNovel ? "scale-100 opacity-100" : "scale-95 opacity-0")
          }
          role="dialog"
          aria-modal="true"
        >
          <div className="p-5 border-b border-slate-200">
            <h3 className="text-xl font-semibold text-slate-800">
              🚩 Báo cáo truyện
            </h3>

            <p className="mt-1 text-sm text-slate-600">
              Đối tượng:{" "}
              <span className="font-medium text-slate-800">
                "{book?.title}"
              </span>
            </p>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">
                Loại báo cáo
              </label>

              <select
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-slate-400 focus:ring-slate-100"
                value={novelReportType}
                onChange={(e) => setNovelReportType(e.target.value)}
              >
                <option>Nội dung không phù hợp</option>
                <option>Vi phạm bản quyền</option>
                <option>Spam / quảng cáo</option>
                <option>Khác…</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">
                Mô tả chi tiết
              </label>

              <textarea
                rows={5}
                placeholder="Mô tả vấn đề, dẫn chứng… (tối thiểu 10 ký tự)"
                className={
                  "w-full rounded-2xl border px-3 py-2.5 text-sm focus:border-slate-400 focus:ring-slate-100 " +
                  (novelErrors.text ? "border-rose-400" : "border-slate-300")
                }
                value={novelReportText}
                onChange={(e) => setNovelReportText(e.target.value)}
              />

              {novelErrors.text && (
                <div className="mt-1 text-sm text-rose-600">
                  {novelErrors.text}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">
                Ảnh minh chứng (tuỳ chọn)
              </label>

              <div className="flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={onPickNovelFiles}
                  />
                  Tải ảnh lên
                </label>

                <span className="text-xs text-slate-400">
                  Có thể chọn nhiều ảnh.
                </span>
              </div>

              {novelReportFiles.length > 0 && (
                <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {novelReportFiles.map((f) => (
                    <div key={f.name} className="relative group">
                      <img
                        src={f.url}
                        alt={f.name}
                        className="h-24 w-full rounded-xl border border-slate-200 object-cover"
                      />

                      <button
                        type="button"
                        onClick={() => removeNovelFile(f.name)}
                        className="absolute right-1 top-1 hidden rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-xs text-slate-700 group-hover:inline-flex hover:bg-white"
                        title="Xóa ảnh"
                      >
                        ×
                      </button>

                      <div
                        className="mt-1 line-clamp-1 text-[11px] text-slate-500"
                        title={f.name}
                      >
                        {f.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 p-5">
            <button
              onClick={() => {
                setOpenReportNovel(false);
                resetNovelForm();
              }}
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              disabled={sendingNovel}
            >
              Hủy bỏ
            </button>

            <button
              onClick={submitNovelReport}
              disabled={sendingNovel}
              className={
                "rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition " +
                (sendingNovel
                  ? "opacity-70 cursor-not-allowed"
                  : "hover:bg-indigo-700 hover:text-white hover:shadow-xl")
              }
            >
              {sendingNovel ? "Đang gửi..." : "Gửi báo cáo"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}