// src/pages/Reader.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { API_BASE, api } from "../lib/api";
import { inLibrary, addToLibrary } from "../utils/library";
import { setProgress } from "../utils/progress";

/* ===== Text-To-Speech (Browser TTS) ===== */
const synth = window.speechSynthesis;
function useTTS(text) {
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef(null);

  const start = () => {
    if (!text || speaking) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "vi-VN";
    utter.rate = 1;
    utter.pitch = 1;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    utterRef.current = utter;
    synth.speak(utter);
    setSpeaking(true);
  };

  const stop = () => {
    synth.cancel();
    setSpeaking(false);
  };

  return { speaking, start, stop };
}

/* ===== Hook click outside ===== */
function useClickOutside(ref, onClose) {
  useEffect(() => {
    const fn = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [ref, onClose]);
}

/* ===== Helpers ===== */
function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem("sessionUser") || "null");
  } catch {
    return null;
  }
}
function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const isUserVIP = (u) => {
  if (!u) return false;
  return !!(u.isVIP || u.vip || u.isVip || u.role === "vip" || u.tier === "vip");
};

export default function Reader() {
  const { id: novelId, no } = useParams();
  const navigate = useNavigate();
  const chapterNo = Number(no || 1);

  const [novel, setNovel] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // UI prefs
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.9);
  const [width, setWidth] = useState("lg"); // sm | md | lg
  const widthCls =
    width === "sm" ? "max-w-3xl" : width === "lg" ? "max-w-6xl" : "max-w-4xl";

  // menu 3 chấm
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setMenuOpen(false));

  // ===== Trạng thái VIP local =====
  const me = getSessionUser();
  const isVIP = isUserVIP(me);
  const [vipOverride, setVipOverride] = useState(false);
  const isVipEffective = isVIP || vipOverride;

  // ===== UI quảng cáo / quay thưởng / mã VIP =====
  const [showAd, setShowAd] = useState(false);
  const [spinResult, setSpinResult] = useState(null);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemMsg, setRedeemMsg] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);

  const [canSkipAd, setCanSkipAd] = useState(false);

  // màu nền giống mẫu
  const [readerTheme, setReaderTheme] = useState("light");
  const articleThemeCls =
    readerTheme === "warm"
      ? "bg-[#f5efe2] text-slate-800"
      : readerTheme === "dark"
      ? "bg-[#111827] text-slate-100"
      : "bg-white text-slate-800";

  const pageBgCls =
    readerTheme === "warm"
      ? "bg-[#ececec]"
      : readerTheme === "dark"
      ? "bg-slate-900"
      : "bg-[#ededed]";

  // ===== Lưu / load UI prefs =====
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("reader_ui_prefs") || "{}");
    if (saved.fontSize) setFontSize(saved.fontSize);
    if (saved.lineHeight) setLineHeight(saved.lineHeight);
    if (saved.width) setWidth(saved.width);
    if (saved.readerTheme) setReaderTheme(saved.readerTheme);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "reader_ui_prefs",
      JSON.stringify({ fontSize, lineHeight, width, readerTheme })
    );
  }, [fontSize, lineHeight, width, readerTheme]);

  // ===== Tải novel + danh sách chương + chương hiện tại =====
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");

    const base = API_BASE || window.location.origin;

    Promise.all([
      fetch(new URL(`/api/novels/${novelId}`, base)).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(new URL(`/api/chapters?novelId=${novelId}`, base), {
        headers: getAuthHeaders(),
      }).then((r) => (r.ok ? r.json() : [])),
      
      fetch(new URL(`/api/chapters/one?novelId=${novelId}&no=${chapterNo}`, base), {
        headers: getAuthHeaders(),
      }).then(async (r) => {
        const data = await r.json().catch(() => null);
      
        if (r.status === 403 && data?.code === "VIP_REQUIRED") {
          return {
            vipRequired: true,
            no: chapterNo,
          };
        }
      
        return r.ok ? data : null;
      }),
    ])
      .then(([novelRes, listRes, oneRes]) => {
        if (!mounted) return;

        if (novelRes && (novelRes._id || novelRes.id)) {
          setNovel({
            id: novelRes._id || novelRes.id,
            title: novelRes.title || "",
            author:
              novelRes.authorName ||
              (typeof novelRes.author === "string"
                ? novelRes.author
                : novelRes?.author?.name) ||
              "",
            cover: novelRes.cover || novelRes.image || "",
          });
        }

        const rawList = Array.isArray(listRes) ? listRes : [];
        const sorted =
          rawList.sort((a, b) => Number(a.no) - Number(b.no)) || [];
        setChapters(sorted);

        if (oneRes?.vipRequired) {
          const currentChapter = sorted.find(
            (c) => Number(c.no) === Number(chapterNo)
          );
        
          setChapter({
            no: chapterNo,
            title: currentChapter?.title || "",
            content: "",
            isPaid: true,
          });
        } else if (oneRes && !oneRes?.message && (oneRes?.no || oneRes?.content)) {
          setChapter({
            no: oneRes.no,
            title: oneRes.title,
            content: oneRes.content || "",
            isPaid: Boolean(oneRes.isPaid),
          });
        } else {
          setChapter(null);
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(e.message || "Lỗi tải dữ liệu");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [novelId, chapterNo]);

  // ===== Tính toán VIP / chương mới nhất =====
  const total = chapters.length;
  const latestNo = useMemo(
    () => (total ? Math.max(...chapters.map((c) => Number(c.no))) : 0),
    [chapters, total]
  );
  const isLatest = total > 0 && Number(chapterNo) === Number(latestNo);
  const vipLocked = Boolean(chapter?.isPaid) && !isVipEffective;

  const tts = useTTS(
    !loading && !vipLocked && chapter?.content ? chapter.content : ""
  );

  const prev = useMemo(
    () => chapters.find((c) => Number(c.no) === chapterNo - 1),
    [chapters, chapterNo]
  );
  const next = useMemo(
    () => chapters.find((c) => Number(c.no) === chapterNo + 1),
    [chapters, chapterNo]
  );
  const progressPct = total ? Math.round((chapterNo / total) * 100) : 0;

  // Lưu tiến độ + thêm vào thư viện
  useEffect(() => {
    if (!novelId || !chapterNo) return;
    setProgress(novelId, chapterNo);

    if (!inLibrary(novelId)) {
      addToLibrary(novelId);
    }

    window.scrollTo({ top: 0, behavior: "instant" });
  }, [novelId, chapterNo]);

  // ===== Phím tắt Alt + ← / → =====
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey) return;
      if (e.key === "ArrowLeft" && prev) {
        navigate(`/novel/${novelId}/chuong/${chapterNo - 1}`);
      }
      if (e.key === "ArrowRight" && next) {
        navigate(`/novel/${novelId}/chuong/${chapterNo + 1}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [novelId, chapterNo, prev, next, navigate]);

  const onSelectChapter = (e) => {
    const targetNo = Number(e.target.value);
    navigate(`/novel/${novelId}/chuong/${targetNo}`);
  };

  // ===== HANDLERS VIP / QUẢNG CÁO / MÃ CODE =====
  const handleWatchAd = () => {
    setShowAd(true);
    setSpinResult(null);
  };

  const handleAdFinished = () => {
    if (!canSkipAd) return;
    setShowAd(false);
    navigate("/wheel-spin");
  };

  useEffect(() => {
    let timer;
    if (showAd) {
      setCanSkipAd(false);
      timer = setTimeout(() => {
        setCanSkipAd(true);
      }, 15000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showAd]);

  const handleRedeem = async () => {
    if (!redeemCode.trim()) {
      setRedeemMsg("Vui lòng nhập mã VIP.");
      return;
    }
    try {
      setRedeemLoading(true);
      setRedeemMsg("");
      const res = await api.vip.redeem(redeemCode.trim());

      setRedeemMsg(res.message || "Đổi mã thành công. Bạn đã trở thành VIP.");
      setVipOverride(true);

      const currentUser = getSessionUser() || {};

      localStorage.setItem(
        "sessionUser",
        JSON.stringify({
          ...currentUser,
          isVip: true,
          vipUntil: res.vipUntil || currentUser.vipUntil,
        })
      );
    } catch (e) {
      setRedeemMsg(e?.message || "Đổi mã thất bại. Vui lòng thử lại.");
    } finally {
      setRedeemLoading(false);
    }
  };

  if (!loading && (!novel || (!chapter && !total))) {
    return (
      <>
        <Header />
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
            <h1 className="text-2xl font-semibold mb-4 text-slate-800">
              Không tìm thấy chương
            </h1>
            <Link
              to="/home"
              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              ← Về trang chủ
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

      <div className={`min-h-screen ${pageBgCls} py-8`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-4xl rounded-xl border border-slate-200 bg-[#f7f7f7] p-5 sm:p-6 shadow-sm">
            {/* breadcrumb */}
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-slate-500">
              <Link to="/home" className="hover:text-slate-800">
                Trang chủ
              </Link>
              <span>›</span>
              <span>{novel?.title || "Đọc truyện"}</span>
            </div>

            {/* top reading controls like sample */}
            <div className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span>Cỡ chữ:</span>
                    <button
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                      onClick={() => setFontSize((v) => Math.max(14, v - 1))}
                    >
                      A-
                    </button>
                    <button
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                      onClick={() => setFontSize((v) => Math.min(24, v + 1))}
                    >
                      A+
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span>Màu nền:</span>
                    <button
                      onClick={() => setReaderTheme("light")}
                      className={`h-5 w-5 rounded-full border ${
                        readerTheme === "light" ? "ring-2 ring-slate-400" : ""
                      } bg-white`}
                      title="Sáng"
                    />
                    <button
                      onClick={() => setReaderTheme("warm")}
                      className={`h-5 w-5 rounded-full border ${
                        readerTheme === "warm" ? "ring-2 ring-slate-400" : ""
                      } bg-[#f5efe2]`}
                      title="Ấm"
                    />
                    <button
                      onClick={() => setReaderTheme("dark")}
                      className={`h-5 w-5 rounded-full border ${
                        readerTheme === "dark" ? "ring-2 ring-slate-400" : ""
                      } bg-slate-900`}
                      title="Tối"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    disabled={!prev}
                    onClick={() =>
                      navigate(`/novel/${novelId}/chuong/${chapterNo - 1}`)
                    }
                  >
                    ‹ Chương trước
                  </button>

                  <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-slate-300 bg-[#fafafa] px-4 py-2">
                    <button
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      onClick={() => navigate(-1)}
                    >
                      ← Quay lại
                    </button>

                    <div className="h-5 w-px bg-slate-300" />

                    <select
                      className="min-w-0 flex-1 truncate bg-transparent text-sm text-slate-700 outline-none"
                      value={chapterNo}
                      onChange={onSelectChapter}
                      title="Chọn chương cần đọc"
                    >
                      {chapters.map((c) => {
                        const isVipChapter = Boolean(c.isPaid);

                        return (
                          <option key={c._id || c.no} value={c.no}>
                            {`Chương ${c.no}: ${c.title || "Không tiêu đề"}${
                              isVipChapter ? " 🔒 VIP" : ""
                            }`}
                          </option>
                        );
                      })}
                    </select>

                    {chapters.find((c) => Number(c.no) === Number(chapterNo))?.isPaid && (
                      <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        VIP
                      </span>
                    )}
                  </div>

                  <button
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    disabled={!next}
                    onClick={() =>
                      navigate(`/novel/${novelId}/chuong/${chapterNo + 1}`)
                    }
                  >
                    {!next
                      ? "Chương sau ›"
                      : Boolean(next?.isPaid) && !isVipEffective
                      ? "Chương sau › 🔒"
                      : "Chương sau ›"}
                  </button>
                </div>

                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-2 bg-slate-800 transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Hoàn thành {progressPct}%
                  </div>
                </div>
              </div>
            </div>

            {/* vip banner */}
            {vipLocked && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <p className="leading-7">
                  Đây là chương trả phí chỉ dành cho tài khoản VIP.
                  <br />
                  Xem quảng cáo để quay vòng quay may mắn, có cơ hội trúng mã VIP.
                  <br />
                  Hoặc mua trực tiếp gói VIP với giá <b>5.000đ / 1 ngày</b> hoặc{" "}
                  <b>99.000đ / 1 tháng</b>.
                </p>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
                    onClick={handleWatchAd}
                  >
                    Xem quảng cáo để quay thưởng
                  </button>

                  <Link
                  to="/vip"
                  className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-white font-medium hover:opacity-90"
                >
                  Mua VIP ngay
                </Link>
                </div>

                <div className="mt-4 border-t border-amber-200 pt-4">
                  <div className="mb-2 text-sm font-semibold">
                    Nhập mã VIP để tiếp tục đọc:
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={redeemCode}
                      onChange={(e) =>
                        setRedeemCode(e.target.value.toUpperCase())
                      }
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
                      placeholder="Ví dụ: ABCD1234"
                    />

                    <button
                      onClick={handleRedeem}
                      disabled={redeemLoading}
                      className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-900 disabled:opacity-60"
                    >
                      {redeemLoading ? "Đang xử lý..." : "Đổi mã"}
                    </button>
                  </div>

                  {redeemMsg && (
                    <div className="mt-2 text-sm text-amber-900">
                      {redeemMsg}
                    </div>
                  )}
                </div>

                {spinResult && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
                    <div className="mb-1 font-semibold">Kết quả vòng quay:</div>
                    <div>{spinResult.prizeLabel}</div>
                    {spinResult.vipCode && (
                      <div className="mt-2">
                        🎁 Mã VIP của bạn:{" "}
                        <span className="font-mono font-bold">
                          {spinResult.vipCode}
                        </span>{" "}
                        ({spinResult.days} ngày)
                        <div className="mt-1 text-xs text-slate-500">
                          Hãy lưu lại mã hoặc nhập luôn vào ô "Nhập mã VIP" phía trên để kích hoạt.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* content area */}
            <article
              className={`rounded-lg border border-slate-200 px-6 py-8 sm:px-12 sm:py-10 ${articleThemeCls}`}
            >
              {/* menu 3 chấm */}
              <div ref={menuRef} className="relative mb-4 flex justify-end">
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-700 hover:bg-slate-50"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                      <circle cx="5" cy="12" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="19" cy="12" r="2" />
                    </svg>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                      <Link
                        to={`/report?type=chapter&novelId=${novelId}&no=${chapterNo}`}
                        className="block w-full px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        🚩 Báo cáo chương
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              <h1
                className={`mx-auto flex max-w-full items-center justify-center gap-2 text-center text-3xl font-semibold leading-snug ${
                  readerTheme === "dark" ? "text-slate-50" : "text-slate-700"
                }`}
              >
                <span className="block max-w-full truncate">
                  {novel?.title || ""}
                  {chapter?.title ? ` - ${chapter.title}` : ""}
                </span>

                {(chapter?.isPaid ||
                  chapters.find((c) => Number(c.no) === Number(chapterNo))?.isPaid) && (
                  <span
                    className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
                    title="Chương VIP"
                  >
                    🔒 VIP
                  </span>
                )}
              </h1>

              <div
                className={`mt-3 border-b pb-5 text-center text-sm ${
                  readerTheme === "dark"
                    ? "border-slate-700 text-slate-400"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                Tác giả: <span className="font-medium">{novel?.author || ""}</span>
              </div>

              {/* tts and reading prefs small row */}
              <div
                className={`mt-4 flex flex-wrap items-center justify-center gap-2 text-sm ${
                  readerTheme === "dark" ? "text-slate-300" : "text-slate-600"
                }`}
              >
                <button
                  className={`rounded border px-3 py-1.5 transition ${
                    readerTheme === "dark"
                      ? "border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-100"
                      : "border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                  }`}
                  onClick={() => (tts.speaking ? tts.stop() : tts.start())}
                >
                  {tts.speaking ? "⏹ Dừng đọc" : "🔊 Đọc chương"}
                </button>

                <button
                  className={`rounded border px-2 py-1 ${
                    readerTheme === "dark"
                      ? "border-slate-600 bg-slate-800 hover:bg-slate-700"
                      : "border-slate-300 bg-white hover:bg-slate-50"
                  }`}
                  onClick={() => setFontSize((v) => Math.max(14, v - 1))}
                >
                  A-
                </button>
                <button
                  className={`rounded border px-2 py-1 ${
                    readerTheme === "dark"
                      ? "border-slate-600 bg-slate-800 hover:bg-slate-700"
                      : "border-slate-300 bg-white hover:bg-slate-50"
                  }`}
                  onClick={() => setFontSize((v) => Math.min(24, v + 1))}
                >
                  A+
                </button>
              </div>

              <div
                className={`${
                  readerTheme === "dark" ? "text-slate-200" : "text-slate-700"
                } mt-8`}
                style={{ fontSize: `${fontSize}px`, lineHeight }}
              >
                <div className="mx-auto max-w-none whitespace-pre-wrap leading-relaxed">
                  {loading
                    ? "Đang tải..."
                    : vipLocked
                    ? "Chương này đang bị khóa. Vui lòng sử dụng các lựa chọn VIP phía trên để mở khóa nội dung."
                    : chapter?.content?.trim()
                    ? chapter.content
                    : "Chưa có dữ liệu chương."}
                </div>
              </div>

              {/* bottom nav like sample */}
              <div
                className={`mt-10 border-t pt-6 ${
                  readerTheme === "dark" ? "border-slate-700" : "border-slate-200"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    disabled={!prev}
                    onClick={() =>
                      navigate(`/novel/${novelId}/chuong/${chapterNo - 1}`)
                    }
                  >
                    ‹ Chương trước
                  </button>

                  <button
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                    onClick={() => navigate(-1)}
                  >
                    ☰ Mục lục
                  </button>

                  <button
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    disabled={!next}
                    onClick={() =>
                      navigate(`/novel/${novelId}/chuong/${chapterNo + 1}`)
                    }
                  >
                    {!next
                      ? "Chương sau ›"
                      : !isVipEffective && Number(next.no) === latestNo
                      ? "Chương sau › 🔒"
                      : "Chương sau ›"}
                  </button>
                </div>
              </div>
            </article>

            {/* tip */}
            <p className="mt-4 text-center text-xs text-slate-500">
              Mẹo: Nhấn <kbd className="rounded border px-1">Alt</kbd> +{" "}
              <kbd className="rounded border px-1">←</kbd> /{" "}
              <kbd className="rounded border px-1">→</kbd> để chuyển chương nhanh.
            </p>
          </div>
        </div>
      </div>

      {/* Modal quảng cáo */}
      {showAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <video
            src="/ads/videoplayback.mp4"
            autoPlay
            controls
            className="h-full w-full object-cover"
          />

          <button
            className={`absolute bottom-6 right-6 rounded-xl px-6 py-3 font-semibold shadow-lg ${
              canSkipAd
                ? "bg-white/85 text-black backdrop-blur-md hover:bg-white"
                : "cursor-not-allowed bg-gray-500/70 text-gray-200"
            }`}
            disabled={!canSkipAd}
            onClick={handleAdFinished}
          >
            {canSkipAd
              ? "Tôi đã xem xong → Quay thưởng"
              : "Vui lòng xem hết 15 giây quảng cáo..."}
          </button>
        </div>
      )}

      <Footer />
    </>
  );
}