// src/components/Header.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem("sessionUser") || "null");
  } catch {
    return null;
  }
}

function getCurrentUserName() {
  const sessionUser = getSessionUser();
  const fromSession =
    sessionUser?.name || sessionUser?.fullname || sessionUser?.username || "";
  const fromLegacy = localStorage.getItem("currentUserName") || "";
  return (fromSession || fromLegacy || "").trim();
}

function useClickOutside(ref, onClose) {
  useEffect(() => {
    const fn = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [ref, onClose]);
}

export default function Header({
  unreadCount,
  onSearch,
}) {
  const [query, setQuery] = useState("");
  const [openProfile, setOpenProfile] = useState(false);
  const profileRef = useRef(null);
  useClickOutside(profileRef, () => setOpenProfile(false));

  const nav = useNavigate();
  const location = useLocation();
  const userName = getCurrentUserName();
  const isLoggedIn = Boolean(api.auth.getToken() && userName);

  const navItem =
    "relative inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200";
  const active =
    "bg-slate-900 text-white shadow-sm";
  const inactive =
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

  // ==== UNREAD NOTIFICATIONS (auto load nếu không truyền prop) ====
  const [internalUnread, setInternalUnread] = useState(0);

  useEffect(() => {
    if (typeof unreadCount === "number") return;

    let cancelled = false;

    async function fetchUnread() {
      try {
        const res = await api.notifications.list();
        const list =
          Array.isArray(res) ? res : res.items || res.notifications || [];
        const c = list.filter((n) => !n.read).length;
        if (!cancelled) setInternalUnread(c);
      } catch (err) {
        console.error("Load unread notifications error:", err);
      }
    }

    fetchUnread();

    return () => {
      cancelled = true;
    };
  }, [unreadCount]);

  const badgeCount =
    typeof unreadCount === "number" ? unreadCount : internalUnread;

  // ==== UNREAD CHATS ====
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    if (!api.auth.getToken()) {
      setChatUnread(0);
      return;
    }

    let cancelled = false;

    async function fetchChatUnread() {
      try {
        const res = await api.chats.listPartners();
        const list = Array.isArray(res) ? res : res.items || [];
        const totalUnread = list.reduce(
          (sum, item) => sum + Number(item?.unread || 0),
          0
        );
        if (!cancelled) setChatUnread(totalUnread);
      } catch (err) {
        console.error("Load unread chats error:", err);
      }
    }

    fetchChatUnread();

    const timer = setInterval(fetchChatUnread, 10000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isLoggedIn]);

  useEffect(() => {
    if (location.pathname !== "/home") return;
    const value = new URLSearchParams(location.search).get("q");
    if (value !== null) setQuery(value);
  }, [location.pathname, location.search]);

  // ---- Debounce local search khi trang truyền onSearch ----
  useEffect(() => {
    if (!onSearch) return undefined;

    const t = setTimeout(() => {
      onSearch(query.trim());
    }, 250);

    return () => clearTimeout(t);
  }, [query, onSearch]);

  const submitSearch = (e) => {
    e.preventDefault();
    const value = query.trim();

    if (onSearch) {
      onSearch(value);
      return;
    }

    nav(value ? `/home?q=${encodeURIComponent(value)}` : "/home");
  };

  function handleLogout() {
    api.auth.logout();
    localStorage.removeItem("sessionUser");
    localStorage.removeItem("currentUserName");
    setOpenProfile(false);
    nav("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-18 min-h-[72px] items-center justify-between gap-4">
          {/* Left: Brand */}
          <Link to="/home" className="inline-flex items-center gap-3 shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 shadow-md shadow-violet-200/60">
              <span className="text-sm font-bold text-white">DK</span>
            </div>
            <div className="leading-tight">
              <div className="text-lg font-semibold tracking-tight text-slate-900">
                DKStory
              </div>
            </div>
          </Link>

          {/* Center: nav (desktop) */}
          <nav className="hidden lg:flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50/80 p-1">
            <NavLink
              to="/home"
              end
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              Trang chủ
            </NavLink>

            <NavLink
              to="/authors"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              Tác giả
            </NavLink>

            <NavLink
              to="/genres"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              Thể loại
            </NavLink>

            <NavLink
              to="/library"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              Thư viện
            </NavLink>

            <NavLink
              to="/chat"
              className={({ isActive }) =>
                `${navItem} ${isActive ? active : inactive}`
              }
            >
              {({ isActive }) => (
                <span className="relative inline-flex items-center">
                  Chat
                  {chatUnread > 0 && (
                    <span
                      className={`absolute -right-3 -top-2 inline-flex h-5 min-w-[1.15rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold shadow ${
                        isActive
                          ? "bg-rose-500 text-white"
                          : "bg-gradient-to-r from-rose-500 to-pink-500 text-white"
                      }`}
                    >
                      {chatUnread}
                    </span>
                  )}
                </span>
              )}
            </NavLink>
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search (desktop) */}
            <form onSubmit={submitSearch} className="hidden md:block">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm truyện..."
                  className="w-64 lg:w-72 rounded-2xl border border-slate-200 bg-slate-50/90 pl-11 pr-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none placeholder:text-slate-400 transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  type="submit"
                  aria-label="Tìm kiếm"
                  className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="size-4"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m21 21-3.5-3.5" />
                  </svg>
                </button>
              </div>
            </form>

            {/* Notifications */}
            <Link
              to="/notifications"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              aria-label="Notifications"
              title="Thông báo"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="size-5"
              >
                <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
                <path d="M9 21a3 3 0 0 0 6 0" />
              </svg>

              {badgeCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.15rem] items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-pink-500 px-1 text-[10px] font-semibold text-white shadow">
                  {badgeCount}
                </span>
              )}
            </Link>

            {/* User menu */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => {
                  if (!isLoggedIn) {
                    nav("/login");
                    return;
                  }
                  setOpenProfile((v) => !v);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 shadow-sm transition hover:bg-slate-50"
                title={isLoggedIn ? "Tài khoản" : "Đăng nhập"}
                type="button"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-semibold text-white shadow-sm">
                  {(isLoggedIn ? userName : "Đ").charAt(0).toUpperCase()}
                </span>

                <div className="hidden sm:block max-w-[120px] truncate text-sm font-medium text-slate-700">
                  {isLoggedIn ? userName : "Đăng nhập"}
                </div>

                <svg
                  className={`size-4 text-slate-400 transition-transform duration-200 ${
                    isLoggedIn && openProfile ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {isLoggedIn && openProfile && (
                <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
                  <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Đang đăng nhập
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-slate-800">
                      {userName}
                    </div>
                  </div>

                  <div className="p-2">
                    <NavLink
                      to="/profile"
                      onClick={() => setOpenProfile(false)}
                      className="block rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      Hồ sơ cá nhân
                    </NavLink>

                    <NavLink
                      to="/notifications"
                      onClick={() => setOpenProfile(false)}
                      className="block rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      Thông báo
                    </NavLink>

                    <NavLink
                      to="/favorites"
                      onClick={() => setOpenProfile(false)}
                      className="block rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      Danh sách yêu thích
                    </NavLink>

                    <div className="my-2 border-t border-slate-100" />

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                    >
                      Đăng xuất
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile search */}
        <form onSubmit={submitSearch} className="md:hidden pb-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm truyện..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/90 pl-11 pr-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none placeholder:text-slate-400 transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="submit"
              aria-label="Tìm kiếm"
              className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="size-4"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-3.5-3.5" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </header>
  );
}