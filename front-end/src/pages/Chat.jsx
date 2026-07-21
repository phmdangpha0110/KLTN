import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { api } from "../lib/api";

const EMPTY_BLOCK_STATUS = {
  blockedByMe: false,
  blockedMe: false,
  canMessage: true,
};

function formatTime(iso) {
  if (!iso) return "";

  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function PartnerItem({ partner, isActive, onSelect }) {
  const last = partner?.lastMessage;
  const preview = last?.content?.slice(0, 48) || "Bắt đầu trò chuyện";

  return (
    <button
      onClick={() => onSelect?.(partner)}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 ${
        isActive
          ? "bg-slate-100 border-slate-300 shadow-sm"
          : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"
      }`}
    >
      <img
        src={
          partner?.user?.avatar ||
          "https://api.dicebear.com/7.x/miniavs/svg?seed=chat"
        }
        alt={partner?.user?.name}
        className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-slate-800 truncate">
            {partner?.user?.name || "Ẩn danh"}
          </div>

          {last?.createdAt && (
            <span className="text-xs text-slate-400 shrink-0">
              {formatTime(last.createdAt)}
            </span>
          )}
        </div>

        <p className="text-sm text-slate-500 truncate mt-1">
          {preview}
        </p>
      </div>

      {partner?.unread > 0 && (
        <span className="inline-flex items-center justify-center h-5 min-w-[1.25rem] text-[11px] font-semibold px-1 bg-indigo-600 text-white rounded-full shrink-0">
          {partner.unread}
        </span>
      )}
    </button>
  );
}

function MessageBubble({ message, meId }) {
  const isMine = String(message.senderId) === String(meId);

  return (
    <div
      className={`flex ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[82%] sm:max-w-[75%] rounded-3xl px-4 py-3 text-sm shadow-sm ${
          isMine
            ? "bg-indigo-600 text-white rounded-br-xl"
            : "bg-white text-slate-800 border border-slate-200 rounded-bl-xl"
        }`}
      >
        <div className="leading-6 break-words">
          {message.content}
        </div>

        <div
          className={`text-[11px] mt-2 ${
            isMine ? "text-indigo-100" : "text-slate-400"
          }`}
        >
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

export default function Chat() {
  const [partners, setPartners] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [me, setMe] = useState(null);

  const [loadingPartners, setLoadingPartners] =
    useState(false);

  const [loadingMessages, setLoadingMessages] =
    useState(false);

  const [sending, setSending] = useState(false);

  const [text, setText] = useState("");
  const [search, setSearch] = useState("");

  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [blockStatus, setBlockStatus] = useState(
    EMPTY_BLOCK_STATUS
  );

  const [blockLoading, setBlockLoading] = useState(false);

  const [openBlockConfirm, setOpenBlockConfirm] =
    useState(false);

  useEffect(() => {
    if (!api.auth.getToken()) return;

    api.auth
      .me()
      .then((u) => setMe(u))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!api.auth.getToken()) return;

    loadPartners();
  }, []);

  useEffect(() => {
    if (!selected?.user?._id) return undefined;

    loadMessages(selected.user._id);

    const timer = setInterval(() => {
      loadMessages(selected.user._id, {
        silent: true,
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [selected?.user?._id]);

  async function loadPartners() {
    try {
      setLoadingPartners(true);

      const res = await api.chats.listPartners();

      const list = Array.isArray(res)
        ? res
        : res.items || [];

      setPartners(list);

      setSelected((current) => {
        return current || list[0] || null;
      });
    } catch (err) {
      console.error(err);

      alert(
        err.message ||
          "Không tải được danh sách chat."
      );
    } finally {
      setLoadingPartners(false);
    }
  }

  async function loadMessages(
    userId,
    { silent = false } = {}
  ) {
    if (!userId) return;

    try {
      if (!silent) {
        setLoadingMessages(true);
      }

      const res =
        await api.chats.getConversation(userId);

      setSelected((prev) => ({
        ...prev,
        user: res.user,
      }));

      setMessages(res.messages || []);

      setBlockStatus(
        res.blockStatus || EMPTY_BLOCK_STATUS
      );

      setPartners((prev) =>
        prev.map((p) =>
          String(p.user._id) === String(userId)
            ? {
                ...p,
                unread: 0,
              }
            : p
        )
      );
    } catch (err) {
      console.error(err);

      if (err?.data?.blockStatus) {
        setBlockStatus(err.data.blockStatus);
      }

      if (!silent) {
        alert(
          err.message ||
            "Không tải được tin nhắn."
        );
      }
    } finally {
      if (!silent) {
        setLoadingMessages(false);
      }
    }
  }

  async function handleSend(e) {
    e.preventDefault();

    if (
      !text.trim() ||
      !selected?.user?._id ||
      blockStatus.blockedByMe ||
      blockStatus.blockedMe
    ) {
      return;
    }

    try {
      setSending(true);

      const res = await api.chats.sendMessage(
        selected.user._id,
        {
          content: text.trim(),
        }
      );

      const msg = res.message || res;

      setMessages((prev) => [
        ...prev,
        msg,
      ]);

      setText("");

      setPartners((prev) => {
        const otherId = String(
          selected.user._id
        );

        const existing = prev.find(
          (p) =>
            String(p.user._id) === otherId
        );

        const nextPartner = {
          ...(existing || {}),
          user: selected.user,
          lastMessage: msg,
          unread: 0,
        };

        return [
          nextPartner,
          ...prev.filter(
            (p) =>
              String(p.user._id) !== otherId
          ),
        ];
      });
    } catch (err) {
      console.error(err);

      if (err?.data?.blockStatus) {
        setBlockStatus(err.data.blockStatus);
      }

      alert(
        err.message ||
          "Gửi tin nhắn thất bại."
      );
    } finally {
      setSending(false);
    }
  }

  async function handleBlockAction(
    isUnblocking
  ) {
    const userId = selected?.user?._id;

    if (!userId || blockLoading) return;

    try {
      setBlockLoading(true);

      const res = isUnblocking
        ? await api.chats.unblockUser(userId)
        : await api.chats.blockUser(userId);

      setBlockStatus(
        res.blockStatus || EMPTY_BLOCK_STATUS
      );

      setText("");

      if (!isUnblocking) {
        setOpenBlockConfirm(false);
      }

      alert(
        isUnblocking
          ? "Đã bỏ chặn người dùng."
          : "Đã chặn người dùng."
      );
    } catch (err) {
      console.error(err);

      if (err?.data?.blockStatus) {
        setBlockStatus(err.data.blockStatus);
      }

      alert(
        err.message ||
          (isUnblocking
            ? "Bỏ chặn người dùng thất bại."
            : "Chặn người dùng thất bại.")
      );
    } finally {
      setBlockLoading(false);
    }
  }

  function handleToggleBlock() {
    if (
      !selected?.user?._id ||
      blockLoading
    ) {
      return;
    }

    if (blockStatus.blockedByMe) {
      handleBlockAction(true);
      return;
    }

    setOpenBlockConfirm(true);
  }

  const meId = me?._id || me?.id;

  const cannotMessage =
    blockStatus.blockedByMe ||
    blockStatus.blockedMe;

  useEffect(() => {
    const q = search.trim();

    if (!q) {
      setSearchResults([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        if (!api.auth.getToken()) return;

        setSearchLoading(true);

        const res =
          await api.chats.searchUsers(q);

        const list = Array.isArray(res)
          ? res
          : res.items || [];

        setSearchResults(list);
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [search]);

  function selectPartner(partner) {
    setOpenBlockConfirm(false);

    setBlockStatus(
      EMPTY_BLOCK_STATUS
    );

    setMessages([]);
    setSelected(partner);
  }

  function startChat(user) {
    setSearch("");
    setSearchResults([]);

    selectPartner({
      user,
      lastMessage: null,
      unread: 0,
    });
  }

  const sortedPartners = useMemo(
    () =>
      [...partners].sort((a, b) => {
        const aTime = new Date(
          a?.lastMessage?.createdAt || 0
        ).getTime();

        const bTime = new Date(
          b?.lastMessage?.createdAt || 0
        ).getTime();

        return bTime - aTime;
      }),
    [partners]
  );

  const blockNotice =
    blockStatus.blockedByMe
      ? "Bạn đã chặn người dùng này. Bỏ chặn để tiếp tục nhắn tin."
      : blockStatus.blockedMe
        ? "Hiện bạn không thể gửi tin nhắn trong cuộc trò chuyện này."
        : "";

  return (
    <>
      <Header />

      <main className="bg-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="h-[calc(100vh-150px)] min-h-[560px] max-h-[760px] rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col lg:flex-row">
            {/* Sidebar */}
            <div className="lg:w-[340px] xl:w-[370px] border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/70 flex flex-col min-h-0">
              <div className="px-5 pt-5 pb-4 border-b border-slate-200 bg-white shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-800">
                    Tin nhắn
                  </h1>

                  <button
                    onClick={loadPartners}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60"
                    disabled={loadingPartners}
                    title="Làm mới"
                    aria-label="Làm mới"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`h-5 w-5 ${
                        loadingPartners
                          ? "animate-spin"
                          : ""
                      }`}
                    >
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                      <path d="M21 3v6h-6" />
                    </svg>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) =>
                      setSearch(e.target.value)
                    }
                    placeholder="Tìm người để chat"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100"
                  />

                  {searchLoading && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      ...
                    </span>
                  )}

                  {searchResults.length > 0 && (
                    <div className="absolute z-20 mt-2 w-full max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
                      {searchResults.map((u) => (
                        <button
                          key={u._id}
                          className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3 transition"
                          onClick={() =>
                            startChat(u)
                          }
                        >
                          <img
                            src={
                              u.avatar ||
                              "https://api.dicebear.com/7.x/miniavs/svg?seed=chat"
                            }
                            alt={u.name}
                            className="w-10 h-10 rounded-full border border-slate-200"
                          />

                          <div className="min-w-0">
                            <div className="font-medium text-slate-800 truncate">
                              {u.name}
                            </div>

                            <div className="text-xs text-slate-500 truncate">
                              {u.email}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0 space-y-2 overflow-y-auto p-4">
                {sortedPartners.length === 0 &&
                !loadingPartners ? (
                  <p className="text-sm text-slate-500 px-2">
                    Chưa có cuộc trò chuyện nào.
                  </p>
                ) : (
                  sortedPartners.map((p) => (
                    <PartnerItem
                      key={p.user._id}
                      partner={p}
                      isActive={
                        String(
                          selected?.user?._id
                        ) ===
                        String(p.user._id)
                      }
                      onSelect={
                        selectPartner
                      }
                    />
                  ))
                )}
              </div>
            </div>

            {/* Main chat */}
            <div className="flex-1 flex flex-col bg-slate-100/60 min-h-0">
              {selected ? (
                <>
                  <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          selected.user?.avatar ||
                          "https://api.dicebear.com/7.x/miniavs/svg?seed=chat"
                        }
                        alt={
                          selected.user?.name
                        }
                        className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0"
                      />

                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">
                          {
                            selected.user?.name
                          }
                        </div>

                        <div className="text-sm text-slate-500 truncate">
                          {
                            selected.user?.email
                          }
                        </div>

                        {blockStatus.blockedByMe && (
                          <div className="text-xs font-medium text-red-600 mt-1">
                            Bạn đã chặn người này
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={
                        handleToggleBlock
                      }
                      disabled={blockLoading}
                      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                        blockStatus.blockedByMe
                          ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                      }`}
                      title={
                        blockStatus.blockedByMe
                          ? "Bỏ chặn"
                          : "Chặn người dùng"
                      }
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-4 w-4"
                        aria-hidden="true"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                        />

                        <path d="m5.7 5.7 12.6 12.6" />
                      </svg>

                      {blockLoading
                        ? "Đang xử lý..."
                        : blockStatus.blockedByMe
                          ? "Bỏ chặn"
                          : "Chặn"}
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-3 bg-[linear-gradient(to_bottom,#f8fafc,#f1f5f9)]">
                    {loadingMessages ? (
                      <p className="text-sm text-slate-500">
                        Đang tải...
                      </p>
                    ) : messages.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-sm text-slate-500">
                          Bắt đầu cuộc trò chuyện
                          đầu tiên.
                        </p>
                      </div>
                    ) : (
                      messages.map((m) => (
                        <MessageBubble
                          key={m._id}
                          message={m}
                          meId={meId}
                        />
                      ))
                    )}
                  </div>

                  <form
                    onSubmit={handleSend}
                    className="border-t border-slate-200 bg-white px-4 sm:px-5 py-4 shrink-0"
                  >
                    {cannotMessage && (
                      <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                        {blockNotice}
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={text}
                        onChange={(e) =>
                          setText(
                            e.target.value
                          )
                        }
                        disabled={
                          cannotMessage
                        }
                        placeholder={
                          cannotMessage
                            ? "Không thể gửi tin nhắn"
                            : "Nhập tin nhắn..."
                        }
                        className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-300 focus:bg-white focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                      />

                      <button
                        type="submit"
                        disabled={
                          sending ||
                          !text.trim() ||
                          cannotMessage
                        }
                        className="rounded-2xl bg-indigo-600 text-white px-5 py-3 text-sm font-semibold shadow-sm transition hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {sending
                          ? "Đang gửi..."
                          : "Gửi"}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-500 bg-white">
                  Chọn một cuộc trò chuyện để
                  bắt đầu.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Modal xác nhận chặn */}
      <div
        className={`fixed inset-0 z-50 ${
          openBlockConfirm
            ? ""
            : "pointer-events-none"
        }`}
      >
        <div
          onClick={() => {
            if (!blockLoading) {
              setOpenBlockConfirm(false);
            }
          }}
          className={
            "absolute inset-0 bg-black/40 transition-opacity " +
            (openBlockConfirm
              ? "opacity-100"
              : "opacity-0")
          }
        />

        <div
          className={
            "absolute left-1/2 top-1/2 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 transform rounded-3xl border border-slate-200 bg-white shadow-2xl transition " +
            (openBlockConfirm
              ? "scale-100 opacity-100"
              : "scale-95 opacity-0")
          }
          role="dialog"
          aria-modal="true"
          aria-labelledby="block-dialog-title"
        >
          <div className="p-5 border-b border-slate-200">
            <h3
              id="block-dialog-title"
              className="text-xl font-semibold text-slate-800"
            >
              Chặn người dùng
            </h3>

            <p className="mt-1 text-sm text-slate-600">
              Xác nhận chặn{" "}
              <span className="font-medium text-slate-800">
                "
                {selected?.user?.name ||
                  "người dùng này"}
                "
              </span>
            </p>
          </div>

          <div className="p-5">
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                    />

                    <path d="m5.7 5.7 12.6 12.6" />
                  </svg>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Bạn có chắc muốn chặn người
                    dùng này?
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Hai bên sẽ không thể gửi tin
                    nhắn cho nhau cho đến khi bạn
                    bỏ chặn.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 p-5">
            <button
              type="button"
              onClick={() =>
                setOpenBlockConfirm(false)
              }
              disabled={blockLoading}
              className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Hủy bỏ
            </button>

            <button
              type="button"
              onClick={() =>
                handleBlockAction(false)
              }
              disabled={blockLoading}
              className={
                "rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition " +
                (blockLoading
                  ? "cursor-not-allowed opacity-70"
                  : "hover:bg-red-600 hover:text-white hover:shadow-xl")
              }
            >
              {blockLoading
                ? "Đang xử lý..."
                : "Xác nhận chặn"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}