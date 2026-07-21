// src/pages/UpgradeVipSandbox.jsx
import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { api } from "../lib/api";

export default function UpgradeVipSandbox() {
  const [plan, setPlan] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const sessionUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("sessionUser") || "null");
    } catch {
      return null;
    }
  }, []);

  // ── Xử lý khi PayOS redirect về /vip?orderCode=...&status=... ──────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderCode = params.get("orderCode");
    const status = params.get("status");

    if (!orderCode) return;

    // Xoá query string khỏi URL (để không hiện lại nếu user F5)
    window.history.replaceState({}, "", "/vip");

    if (status === "CANCEL") {
      setErr("Bạn đã huỷ thanh toán.");
      return;
    }

    // Kiểm tra trạng thái đơn với backend
    api.payos
      .getOrderStatus(orderCode)
      .then((res) => {
        if (res.status === "paid") {
          // ✅ Cập nhật sessionUser trong localStorage để Profile hiện đúng VIP
          refreshSessionUser();
          setMsg("✅ Thanh toán thành công! Tài khoản của bạn đã được nâng cấp VIP.");
        } else {
          // Webhook chưa về kịp — thử lại sau 3 giây
          setTimeout(() => {
            api.payos
              .getOrderStatus(orderCode)
              .then((res2) => {
                if (res2.status === "paid") {
                  refreshSessionUser();
                  setMsg("✅ Thanh toán thành công! Tài khoản của bạn đã được nâng cấp VIP.");
                } else {
                  setMsg("⏳ Hệ thống đang xử lý, vui lòng tải lại trang sau vài giây.");
                }
              })
              .catch(() =>
                setMsg("⏳ Đang xử lý. Vui lòng tải lại trang sau ít phút.")
              );
          }, 3000);
        }
      })
      .catch(() => {
        setMsg(
          "⏳ Không thể kiểm tra trạng thái. Vui lòng liên hệ admin nếu đã thanh toán."
        );
      });
  }, []);

  // ── Cập nhật sessionUser từ server (để Profile.jsx thấy VIP mới) ────────
  async function refreshSessionUser() {
    try {
      // Gọi trực tiếp, bypass cache
      const token = localStorage.getItem("authToken");

      if (!token) return;
  
      const res = await fetch("http://localhost:5000/api/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
      });
      if (!res.ok) return;
      const fresh = await res.json();
      const current = JSON.parse(localStorage.getItem("sessionUser") || "{}");
      localStorage.setItem("sessionUser", JSON.stringify({ ...current, ...fresh }));
    } catch {
      // bỏ qua
    }
  }

  // ── Bấm "Thanh toán ngay" ───────────────────────────────────────────────
  async function handleCheckout() {
    setErr("");
    setMsg("");

    if (!sessionUser) {
      setErr("Bạn cần đăng nhập trước khi nâng cấp VIP.");
      return;
    }
    if (!plan) {
      setErr("Vui lòng chọn gói trước.");
      return;
    }

    // "vip1d" → "1d" | "vip1m" → "1m"
    const planCode = plan === "vip1d" ? "1d" : "1m";

    try {
      setLoading(true);
      const res = await api.payos.createPaymentLink(planCode);
      if (!res.checkoutUrl) throw new Error("Không nhận được link thanh toán.");
      // Redirect sang trang cổng thanh toán PayOS
      window.location.href = res.checkoutUrl;
    } catch (e) {
      setErr(e.message || "Không thể tạo link thanh toán. Vui lòng thử lại.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 flex flex-col items-center px-4 py-10">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
          Nâng cấp VIP
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Thanh toán an toàn qua cổng PayOS — VIP kích hoạt ngay sau khi thanh
          toán thành công.
        </p>

        {err && (
          <div className="mb-4 w-full max-w-lg rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3">
            {err}
          </div>
        )}

        {msg && (
          <div className="mb-6 w-full max-w-lg rounded-xl border border-green-200 bg-green-50 text-green-700 px-5 py-4 text-center font-medium">
            {msg}
            {msg.startsWith("✅") && (
              <div className="mt-3">
                <Link
                  to="/profile"
                  className="inline-flex items-center rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Xem hồ sơ →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* CHỌN GÓI */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
          <PlanCard
            active={plan === "vip1d"}
            title="VIP 1 ngày"
            price="5,000đ"
            desc="Mở khoá tất cả chương VIP trong 24 giờ."
            onClick={() => {
              setPlan("vip1d");
              setErr("");
            }}
          />
          <PlanCard
            active={plan === "vip1m"}
            title="VIP 1 tháng"
            price="99,000đ"
            desc="Mở khoá tất cả chương VIP trong 30 ngày."
            onClick={() => {
              setPlan("vip1m");
              setErr("");
            }}
          />
        </div>

        {/* NÚT THANH TOÁN */}
        <button
          onClick={handleCheckout}
          disabled={loading || !plan}
          className={`px-10 py-3 rounded-xl text-white font-semibold text-base bg-gradient-to-r from-purple-500 to-pink-500 transition
            ${
              loading || !plan
                ? "opacity-50 cursor-not-allowed"
                : "hover:opacity-90 shadow-lg hover:shadow-xl"
            }`}
        >
          {loading ? "Đang chuyển đến trang thanh toán..." : "Thanh toán ngay"}
        </button>

        <p className="mt-3 text-xs text-gray-400">
          Bạn sẽ được chuyển đến cổng thanh toán PayOS an toàn.
        </p>

        <Link to="/home" className="mt-4 text-sm text-gray-500 hover:underline">
          ← Về trang chủ
        </Link>
      </main>

      <Footer />
    </div>
  );
}

/* Component Card chọn gói */
function PlanCard({ active, title, price, desc, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-64 sm:w-72 text-left rounded-2xl border p-5 transition shadow-sm hover:shadow-md ${
        active ? "border-purple-400 bg-purple-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="text-sm text-gray-600">Gói</div>
      <div className="text-xl font-bold text-gray-900 mt-1">{title}</div>
      <div className="mt-2 text-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
        {price}
      </div>
      <div className="mt-2 text-sm text-gray-600">{desc}</div>
      {active && (
        <div className="mt-3 text-xs inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700">
          ✓ Đã chọn
        </div>
      )}
    </button>
  );
}
