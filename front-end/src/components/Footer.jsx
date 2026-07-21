import { Link } from "react-router-dom";

export default function Footer() {
  const linkClass =
    "inline-block text-white transition-all duration-200 hover:text-amber-400 hover:translate-x-1";

  return (
    <footer className="w-full mt-12 border-t border-slate-800 bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* DKStory */}
          <div>
            <h2 className="text-2xl font-bold text-white">DKStory</h2>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              Nền tảng đọc truyện trực tuyến với giao diện hiện đại, dễ sử dụng
              và tối ưu trải nghiệm đọc cho người dùng.
            </p>

            <div className="mt-5 space-y-3 text-sm">
              <a
                href="mailto:contact@dkstory.com"
                className={linkClass}
              >
                📧 contact@dkstory.com
              </a>

              <a
                href="mailto:support@dkstory.com"
                className={`block ${linkClass}`}
              >
                🛠 support@dkstory.com
              </a>
            </div>
          </div>

          {/* Khám phá */}
          <div>
            <h3 className="text-lg font-semibold text-white">
              Khám phá
            </h3>

            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link to="/home" className={linkClass}>
                  Trang chủ
                </Link>
              </li>

              <li>
                <Link to="/genres" className={linkClass}>
                  Thể loại
                </Link>
              </li>

              <li>
                <Link to="/authors" className={linkClass}>
                  Tác giả
                </Link>
              </li>

              <li>
                <Link to="/vip" className={linkClass}>
                  Nâng cấp VIP
                </Link>
              </li>
            </ul>
          </div>

          {/* Tài khoản */}
          <div>
            <h3 className="text-lg font-semibold text-white">
              Tài khoản
            </h3>

            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link to="/profile" className={linkClass}>
                  Hồ sơ cá nhân
                </Link>
              </li>

              <li>
                <Link to="/library" className={linkClass}>
                  Thư viện
                </Link>
              </li>

              <li>
                <Link to="/favorites" className={linkClass}>
                  Yêu thích
                </Link>
              </li>

              <li>
                <Link to="/notifications" className={linkClass}>
                  Thông báo
                </Link>
              </li>
            </ul>
          </div>

          {/* Cộng đồng */}
          <div>
            <h3 className="text-lg font-semibold text-white">
              Cộng đồng và Sáng tác
            </h3>

            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link to="/studio" className={linkClass}>
                  Studio tác giả
                </Link>
              </li>

              <li>
                <Link to="/studio/new" className={linkClass}>
                  Đăng truyện
                </Link>
              </li>

              <li>
                <Link to="/chat" className={linkClass}>
                  Chat cộng đồng
                </Link>
              </li>

              <li>
                <Link to="/report" className={linkClass}>
                  Báo cáo vi phạm
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-800 pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-slate-400">
              © 2025 DKStory. All rights reserved.
            </p>

            <div className="flex flex-wrap gap-6 text-sm">
              <Link to="/home" className={linkClass}>
                Trang chủ
              </Link>

              <Link to="/genres" className={linkClass}>
                Thể loại
              </Link>

              <Link to="/vip" className={linkClass}>
                VIP
              </Link>

              <Link to="/report" className={linkClass}>
                Báo cáo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}