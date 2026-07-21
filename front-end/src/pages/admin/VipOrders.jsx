// src/pages/admin/VipOrders.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminHeader from "../../components/admin/AdminHeader";
import { api } from "../../lib/api";

export default function VipOrders() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );

  const filteredItems = useMemo(() => {
    if (!selectedMonth) return items;

    const [year, month] = selectedMonth.split("-").map(Number);

    return items.filter((o) => {
      const date = new Date(o.paidAt || o.createdAt);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    });
  }, [items, selectedMonth]);

  // Tính doanh thu tháng đang lọc từ danh sách đã load
  const monthlyRevenue = useMemo(() => {
    return filteredItems.reduce((sum, o) => sum + Number(o.amount || 0), 0);
  }, [filteredItems]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.admin.vipOrders.list({ status: "paid" });
      const rows = Array.isArray(res)
        ? res
        : Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res?.orders)
        ? res.orders
        : Array.isArray(res?.data)
        ? res.data
        : [];
      setItems(rows);
    } catch (e) {
      alert(e.message || "Không thể tải đơn VIP.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Quản lý đơn VIP" />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Thông báo hệ thống tự động */}
    

        <div className="mb-4 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-3xl font-bold text-gray-900">
              Quản lý đơn hàng
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
              />

              <button
                onClick={load}
                disabled={loading}
                className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? "Đang tải..." : "↺"}
              </button>
            </div>
          </div>
        </div>

        {/* BẢNG ĐƠN */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Mã đơn</th>
                  <th className="px-3 py-3 text-left font-semibold">
                    Người dùng
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">Gói</th>
                  <th className="px-3 py-3 text-left font-semibold">
                    Số tiền
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">VIP đến</th>
                  <th className="px-3 py-3 text-left font-semibold">
                    Thanh toán lúc
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-gray-400"
                    >
                      Đang tải...
                    </td>
                  </tr>
                )}
                {!loading && filteredItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-gray-400"
                    >
                      Chưa có đơn thanh toán nào.
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredItems.map((o) => (
                    <tr key={o._id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-3 font-medium text-gray-900">
                        {o.orderId}
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-800">
                          {o.userId?.name || "Không rõ"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {o.userId?.email || ""}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        {o.plan === "1d" ? "VIP 1 ngày" : "VIP 1 tháng"}
                      </td>

                      <td className="px-3 py-3 font-semibold text-green-700">
                        {Number(o.amount || 0).toLocaleString("vi-VN")}đ
                      </td>

                      <td className="px-3 py-3 text-gray-600">
                        {o.userId?.vipUntil
                          ? new Date(o.userId.vipUntil).toLocaleString("vi-VN")
                          : "—"}
                      </td>

                      <td className="px-3 py-3 text-gray-600">
                        {o.paidAt
                          ? new Date(o.paidAt).toLocaleString("vi-VN")
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* DOANH THU */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_240px]">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-medium uppercase tracking-wide text-gray-500">
              Doanh thu VIP tháng này
            </div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-3xl font-bold text-green-700">
                {monthlyRevenue.toLocaleString("vi-VN")}
              </span>
              <span className="pb-1 text-base font-medium text-green-600">
                VNĐ
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-400">
              Số lượng đơn: {filteredItems.length} đơn
            </div>
          </div>

          <Link
            to="/admin/revenue"
            className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-500 p-5 text-white shadow-sm transition hover:scale-[1.02] hover:shadow-md"
          >
            <span className="text-lg font-semibold">Trang doanh thu</span>
          </Link>
        </div>
      </div>
    </div>
  );
}