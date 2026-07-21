import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, NavLink } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { api, API_BASE } from "../lib/api";

const pickArray = (res) =>
  Array.isArray(res) ? res : res?.items || res?.data || [];

function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem("sessionUser") || "null");
  } catch {
    return null;
  }
}

function unwrapUser(res) {
  return res?.user || res?.data?.user || res?.data || res || null;
}

function normalizeUserPayload(res) {
  const u = unwrapUser(res);
  if (!u) return null;

  const vipUntil =
    u.vipUntil ||
    u.vipExpiresAt ||
    u.vipExpiredAt ||
    u.vipExpireAt ||
    u.premiumUntil ||
    null;

  const vipStillValid = vipUntil
    ? (() => {
        const d = new Date(vipUntil);
        return !Number.isNaN(d.getTime()) && d.getTime() > Date.now();
      })()
    : false;

  return {
    ...u,
    id: u.id || u._id,
    _id: u._id || u.id,
    isVip: Boolean(u.isVip || u.vip || vipStillValid),
    vipUntil,
  };
}

function checkVip(user) {
  if (!user) return false;

  if (user.isVip === true || user.vip === true) return true;

  const untilValue =
    user.vipUntil ||
    user.vipExpiresAt ||
    user.vipExpiredAt ||
    user.vipExpireAt ||
    user.premiumUntil;

  if (untilValue) {
    const until = new Date(untilValue);
    return !Number.isNaN(until.getTime()) && until.getTime() > Date.now();
  }

  return false;
}

export default function Profile() {
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadMe() {
      setLoadingMe(true);
      setErr("");

      const fromLS = normalizeUserPayload(getSessionUser());

      if (fromLS && mounted) {
        setMe(fromLS);
      }

      try {
        let freshFromUsers = null;
        let freshFromAuth = null;

        try {
          freshFromUsers = normalizeUserPayload(await api.auth.me());
        } catch {
          freshFromUsers = null;
        }

        try {
          freshFromAuth = normalizeUserPayload(await api.auth.meAuth());
        } catch {
          freshFromAuth = null;
        }

        if (!mounted) return;

        const merged = normalizeUserPayload({
          ...(fromLS || {}),
          ...(freshFromUsers || {}),
          ...(freshFromAuth || {}),
        });

        if (merged) {
          const finalUser = {
            ...merged,
            isVip:
              checkVip(fromLS) ||
              checkVip(freshFromUsers) ||
              checkVip(freshFromAuth) ||
              checkVip(merged),
            vipUntil:
              freshFromUsers?.vipUntil ||
              freshFromAuth?.vipUntil ||
              fromLS?.vipUntil ||
              merged.vipUntil ||
              null,
          };

          setMe(finalUser);
          localStorage.setItem("sessionUser", JSON.stringify(finalUser));
        } else {
          setMe(null);
        }
      } catch (e) {
        if (!mounted) return;

        if (!fromLS) {
          setMe(null);
        }

        setErr(e.message || "Lỗi tải người dùng");
      } finally {
        if (mounted) {
          setLoadingMe(false);
        }
      }
    }

    loadMe();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!me) {
      setBooks([]);
      setLoadingBooks(false);
      return;
    }

    let mounted = true;
    setLoadingBooks(true);
    setErr("");

    const base = API_BASE || window.location.origin;
    const url = new URL("/api/novels", base);

    const myId = me._id || me.id;

    if (myId) {
      url.searchParams.set("authorId", myId);
    }

    fetch(url.toString())
      .then((r) => (r.ok ? r.json() : []))
      .then((res) => {
        if (!mounted) return;

        const arr = pickArray(res);

        const onlyMine = arr.filter((n) => {
          const aId =
            n.authorId ||
            (typeof n.author === "object"
              ? n.author?._id || n.author?.id
              : null);

          if (!aId || !myId) return false;

          return String(aId) === String(myId);
        });

        const norm = onlyMine.map((n) => ({
          id: n._id || n.id,
          title: n.title || "",
          cover: n.cover || n.image || "",
          author:
            n.authorName ||
            (typeof n.author === "string" ? n.author : n?.author?.name) ||
            "",
          description: n.description || "",
        }));

        setBooks(norm);
      })
      .catch((e) => {
        if (mounted) {
          setErr(e.message || "Lỗi tải tác phẩm");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingBooks(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [me]);

  const authorName = useMemo(
    () => me?.name || me?.fullname || me?.username || "Không tên",
    [me]
  );

  const isVip = useMemo(() => checkVip(me), [me]);

  const vipBadgeCls = isVip
    ? "bg-yellow-100 text-yellow-800 border-yellow-200"
    : "bg-gray-100 text-gray-700 border-gray-200";

  const vipUntilText =
    isVip && me?.vipUntil
      ? (() => {
          const d = new Date(me.vipUntil);
          return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("vi-VN");
        })()
      : "";

  function handleLogout() {
    try {
      api?.auth?.logout?.();
    } catch {}

    localStorage.removeItem("sessionUser");
    navigate("/login");
  }

  return (
    <>
      <Header />

      <div className="min-h-screen p-6 bg-white">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="bg-white shadow-sm rounded-2xl p-6 flex items-center gap-6">
            <img
              src={
                me?.avatar ||
                "https://api.dicebear.com/7.x/thumbs/svg?seed=dkstory"
              }
              alt="avatar"
              className="w-24 h-24 rounded-full ring-2 ring-purple-200 object-cover"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-800 truncate">
                  {loadingMe ? "Đang tải..." : authorName}
                </h2>

                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${vipBadgeCls}`}
                >
                  {isVip ? "⭐ VIP" : "Thường"}
                </span>
              </div>

              <p className="text-sm text-gray-500 mt-1">
                Tác giả • Thành viên từ{" "}
                {me?.createdAt?.slice(0, 4) || "2025"}
              </p>

              {isVip && vipUntilText && (
                <p className="text-xs text-gray-600 mt-1">
                  Hiệu lực VIP đến:{" "}
                  <span className="font-medium text-gray-900">
                    {vipUntilText}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/vip"
                className={`px-5 py-2 rounded-xl font-medium shadow transition whitespace-nowrap inline-block ${
                  isVip
                    ? "border border-yellow-300 text-yellow-800 bg-yellow-50 hover:bg-yellow-100"
                    : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90"
                }`}
                title={isVip ? "Gia hạn VIP" : "Nâng cấp VIP"}
              >
                {isVip ? "Gia hạn VIP" : "Nâng cấp VIP"}
              </Link>

              <NavLink
                to="/profile/edit"
                className="px-5 py-2 rounded-xl border border-purple-200 text-gray-800 hover:bg-purple-50 transition whitespace-nowrap inline-block text-center"
              >
                Chỉnh sửa hồ sơ
              </NavLink>

              <Link
                to="/studio"
                className="px-5 py-2 rounded-xl border border-purple-200 text-gray-800 hover:bg-purple-50 transition whitespace-nowrap inline-block text-center"
              >
                Sáng tác
              </Link>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                label: "Truyện đã đăng",
                value: loadingBooks ? "…" : String(books.length),
              },
              {
                label: "Người theo dõi",
                value:
                  typeof me?.followersCount === "number"
                    ? me.followersCount
                    : "—",
              },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-white shadow-sm rounded-2xl p-5 text-center"
              >
                <p className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  {item.value}
                </p>
                <p className="text-sm text-gray-500">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="bg-white shadow-sm rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Giới thiệu
            </h3>
            <p className="text-gray-600">
              {me?.bio ||
                "Yêu thích sáng tác fantasy, huyền huyễn. Mục tiêu 1 chương/ngày."}
            </p>
          </div>

          <div className="bg-white shadow-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Tác phẩm của {authorName}
              </h3>

              <span className="text-sm text-gray-500">
                Tổng: <span className="font-medium">{books.length}</span> truyện
              </span>
            </div>

            {err && (
              <div className="mb-4 rounded-xl border border-pink-200 bg-pink-50 text-pink-700 px-4 py-3">
                {err}
              </div>
            )}

            {loadingBooks ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 animate-pulse">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-gray-200 p-3"
                  >
                    <div className="h-48 bg-purple-100/60 rounded" />
                    <div className="mt-2 h-4 bg-purple-100/60 rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : books.length === 0 ? (
              <div className="text-gray-600">
                Chưa có tác phẩm nào được đăng.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {books.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col"
                  >
                    <Link to={`/novel/${b.id}`} className="block">
                      <img
                        src={b.cover}
                        alt={b.title}
                        className="w-full h-48 object-cover"
                      />
                    </Link>

                    <div className="p-4 flex-1 flex flex-col">
                      <Link
                        to={`/novel/${b.id}`}
                        className="font-semibold hover:underline line-clamp-2"
                        title={b.title}
                      >
                        {b.title}
                      </Link>

                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                        {b.description}
                      </p>

                      <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                        <Link
                          to={`/novel/${b.id}`}
                          className="px-3 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 transition"
                        >
                          Chi tiết
                        </Link>

                        <Link
                          to={`/novel/${b.id}/chuong/1`}
                          className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:shadow transition"
                        >
                          Đọc ngay
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </>
  );
}