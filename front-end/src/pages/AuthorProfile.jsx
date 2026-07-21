// front-end/src/pages/AuthorProfile.jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import Header from "../components/Header";
import Footer from "../components/Footer";

export default function AuthorProfile() {
  const { id } = useParams();

  const [author, setAuthor] = useState(null);
  const [works, setWorks] = useState([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id) {
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");

      const data = await api.authors.detail(id);
      console.log("Author detail API response:", data);

      const authorData = data.author || data.item || data;
      if (!authorData || !authorData._id) {
        setAuthor(null);
        setWorks([]);
        setFollowersCount(0);
        setIsFollowing(false);
        setError("Không tìm thấy tác giả.");
        return;
      }
      setAuthor(authorData);

      if (Array.isArray(data.works)) {
        setWorks(data.works);
      } else if (Array.isArray(data.novels)) {
        setWorks(data.novels);
      } else {
        setWorks([]);
      }

      const followers =
        data.followersCount ??
        data.followers ??
        data.followerCount ??
        authorData.followersCount ??
        0;
      setFollowersCount(followers);

      const followingFlag =
        data.isFollowing ??
        data.is_following ??
        authorData.isFollowing ??
        false;
      setIsFollowing(!!followingFlag);
    } catch (err) {
      console.error("Load author profile error:", err);
      setError(err.message || "Lỗi khi tải thông tin tác giả.");
      setAuthor(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleFollow() {
    try {
      if (!id) return;
      setFollowLoading(true);

      let res;
      if (isFollowing) {
        res = await api.authors.unfollow(id);
      } else {
        res = await api.authors.follow(id);
      }

      if (typeof res.isFollowing !== "undefined") {
        setIsFollowing(res.isFollowing);
      } else {
        setIsFollowing(!isFollowing);
      }

      if (typeof res.followersCount !== "undefined") {
        setFollowersCount(res.followersCount);
      }
    } catch (err) {
      console.error("Toggle follow error:", err);
      if (err.message && err.message.includes("Chưa đăng nhập")) {
        alert("Bạn cần đăng nhập để theo dõi tác giả.");
      }
    } finally {
      setFollowLoading(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-slate-100 py-6 sm:py-8">
          <div className="max-w-5xl mx-auto px-4">
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center text-slate-600 shadow-sm">
              Đang tải thông tin tác giả...
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!loading && !author) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-slate-100 py-6 sm:py-8">
          <div className="max-w-5xl mx-auto px-4">
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center text-slate-600 shadow-sm">
              {error || "Không tìm thấy thông tin tác giả."}
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />

      <div className="min-h-screen bg-slate-100 py-6 sm:py-8">
        <div className="max-w-5xl mx-auto px-4 space-y-6">
          {/* Header Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="flex justify-center md:block">
                <img
                  src={author.avatar || "https://via.placeholder.com/160"}
                  alt={author.name}
                  className="h-24 w-24 rounded-full object-cover ring-4 ring-slate-100 shadow-sm md:h-28 md:w-28"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-800 sm:text-3xl">
                      {author.name}
                    </h1>

                    <div className="mt-4 text-sm">
                      <Link
                        to="/authors"
                        className="inline-flex items-center gap-1 text-slate-600 transition hover:text-indigo-700 hover:scale-[1.04]"
                      >
                        ← Quay lại danh sách tác giả
                      </Link>
                    </div>
                  </div>

                  <button
                    onClick={handleToggleFollow}
                    disabled={followLoading}
                    className={`inline-flex w-full items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-medium transition md:w-auto whitespace-nowrap ${
                      isFollowing
                        ? "bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                        : "border border-slate-300 bg-slate-900 text-white hover:bg-indigo-700 hover:text-white hover:scale-[1.04] hover:shadow-xl"
                        
                    }`}
                  >
                    {isFollowing ? "Bỏ theo dõi" : "Theo dõi"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                label: "Tác phẩm",
                value: String(works.length),
              },
              {
                label: "Người theo dõi",
                value: String(followersCount),
              },
            ].map((item, index) => (
              <div
                key={index}
                className="rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm"
              >
                <p className="text-2xl font-semibold text-slate-800">
                  {item.value}
                </p>
                <p className="mt-1 text-sm text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>

          {/* About */}
          {author.bio && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold text-slate-800">
                Giới thiệu
              </h2>
              <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
                {author.bio}
              </p>
            </div>
          )}

          {/* Works */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                Tác phẩm của {author.name}
              </h2>
              <span className="text-sm text-slate-500">
                Tổng:{" "}
                <span className="font-medium text-slate-800">
                  {works.length}
                </span>{" "}
                truyện
              </span>
            </div>

            {works.length === 0 ? (
              <p className="text-sm text-slate-600">
                Tác giả chưa có tác phẩm nào.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
                {works.map((n) => (
                  <div
                    key={n._id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="h-44 w-full overflow-hidden bg-slate-100">
                      <img
                        src={n.cover || "https://via.placeholder.com/200x280"}
                        alt={n.title}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="flex min-h-[160px] flex-col p-4">
                      <h3
                        className="line-clamp-2 text-sm font-semibold text-slate-800"
                        title={n.title}
                      >
                        {n.title}
                      </h3>

                      <p className="mt-2 text-xs text-slate-500">
                        {n.totalChapters || 0} chương • {n.status || "updating"}
                      </p>

                      <div className="mt-auto flex justify-end gap-2 pt-4">
                        <Link
                          to={`/novel/${n._id || n.id}`}
                          className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-all duration-300 hover:bg-indigo-700 hover:text-white hover:scale-[1.04] hover:shadow-xl"
                        >
                          Xem chi tiết
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && !author && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 shadow-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}