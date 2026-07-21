import { useEffect, useMemo, useState } from "react";
import AdminHeader from "../../components/admin/AdminHeader";
import { api } from "../../lib/api";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function money(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function withdrawalStatusText(status) {
  if (status === "paid") return "Đã thanh toán";
  if (status === "approved") return "Đã duyệt";
  if (status === "rejected") return "Đã từ chối";
  return "Đang chờ duyệt";
}

function withdrawalStatusClass(status) {
  if (status === "paid") return "bg-green-50 text-green-700";
  if (status === "approved") return "bg-blue-50 text-blue-700";
  if (status === "rejected") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

export default function Revenue() {
  const [month, setMonth] = useState(currentMonth());
  const [grossRevenue, setGrossRevenue] = useState("");
  const [items, setItems] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [vipOrders, setVipOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [withdrawalStatus, setWithdrawalStatus] = useState("");

  const totalVipRevenue = useMemo(
    () =>
      vipOrders.reduce((sum, order) => {
        return sum + Number(order.amount || 0);
      }, 0),
    [vipOrders]
  );

  const monthlyVipRevenue = useMemo(
    () =>
      items
        .filter((item) => item.month === month)
        .reduce((sum, item) => {
          if (item.grossRevenue) return sum + Number(item.grossRevenue || 0);
          return sum + Number(item.amount || 0) * 2;
        }, 0),
    [items, month]
  );

  const paidToAuthorsAmount = useMemo(
    () =>
      withdrawals
        .filter((item) => item.status === "paid")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [withdrawals]
  );

  const withdrawalRequestCount = useMemo(
    () =>
      withdrawals.filter(
        (item) => item.status === "pending" || item.status === "approved"
      ).length,
    [withdrawals]
  );

  async function load() {
    setLoading(true);

    try {
      const [revenueRes, withdrawalRes, vipOrderRes] = await Promise.all([
        api.admin.revenue.list({ month }),
        api.adminWithdrawals?.list
          ? api.adminWithdrawals.list({ status: withdrawalStatus })
          : Promise.resolve({ items: [] }),
        api.admin.vipOrders.list({ status: "paid" }),
      ]);

      setItems(Array.isArray(revenueRes.items) ? revenueRes.items : []);
      setWithdrawals(
        Array.isArray(withdrawalRes.items) ? withdrawalRes.items : []
      );
      const vipRows = Array.isArray(vipOrderRes)
        ? vipOrderRes
        : Array.isArray(vipOrderRes?.items)
        ? vipOrderRes.items
        : Array.isArray(vipOrderRes?.orders)
        ? vipOrderRes.orders
        : Array.isArray(vipOrderRes?.data)
        ? vipOrderRes.data
        : [];

      setVipOrders(vipRows);
    } catch (e) {
      alert(e.message || "Không thể tải doanh thu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month, withdrawalStatus]);

  async function calculate() {
    if (!grossRevenue || Number(grossRevenue) <= 0) {
      alert("Vui lòng nhập tổng doanh thu VIP của tháng.");
      return;
    }

    const ok = window.confirm(
      "Tính doanh thu tác giả với tỉ lệ nền tảng giữ lại 50%?"
    );

    if (!ok) return;

    try {
      await api.admin.revenue.calculate({
        month,
        grossRevenue: Number(grossRevenue),
      });

      alert("Đã tính doanh thu tác giả.");
      load();
    } catch (e) {
      alert(e.message || "Không thể tính doanh thu.");
    }
  }

  async function approveWithdrawal(id) {
    try {
      await api.adminWithdrawals.approve(id);
      alert("Đã duyệt yêu cầu rút tiền.");
      load();
    } catch (e) {
      alert(e.message || "Không thể duyệt yêu cầu.");
    }
  }

  async function rejectWithdrawal(id) {
    const reason = window.prompt("Nhập lý do từ chối:", "");

    try {
      await api.adminWithdrawals.reject(id, { adminNote: reason || "" });
      alert("Đã từ chối yêu cầu rút tiền.");
      load();
    } catch (e) {
      alert(e.message || "Không thể từ chối yêu cầu.");
    }
  }

  async function markWithdrawalPaid(id) {
    const ok = window.confirm("Xác nhận đã chuyển khoản cho tác giả?");
    if (!ok) return;

    try {
      await api.adminWithdrawals.markPaid(id);
      alert("Đã đánh dấu yêu cầu rút tiền là đã thanh toán.");
      load();
    } catch (e) {
      alert(e.message || "Không thể cập nhật yêu cầu rút tiền.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Doanh thu tác giả" />

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Quản lý doanh thu
          </h1>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-gray-500">
              Tổng doanh thu
            </div>
            <div className="mt-2 text-3xl font-bold text-green-700">
              {money(totalVipRevenue)}
            </div>
          
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-gray-500">
              Doanh thu tháng này
            </div>
            <div className="mt-2 text-3xl font-bold text-blue-700">
              {money(monthlyVipRevenue)}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-gray-500">
              Đã thanh toán
            </div>
            <div className="mt-2 text-3xl font-bold text-amber-700">
              {money(paidToAuthorsAmount)}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm font-medium text-gray-500">
              Yêu cầu rút tiền chưa xử lí
            </div>
            <div className="mt-2 text-3xl font-bold text-purple-700">
              {withdrawalRequestCount} lượt
            </div>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Tính doanh thu tác giả
          </h2>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tháng
              </label>

              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Doanh thu tháng
              </label>

              <input
                type="number"
                value={grossRevenue}
                onChange={(e) => setGrossRevenue(e.target.value)}
                placeholder="Ví dụ: 10000000"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={calculate}
                className="w-full rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Tính doanh thu
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Nền tảng 50% x Tác giả 50% (Theo đóng góp)
          </p>
        </div>

        {/* DANH SÁCH DOANH THU */}
        <div className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-white px-5 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Danh sách doanh thu theo tháng
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Tác giả</th>
                  <th className="px-3 py-3 text-left font-semibold">Tháng</th>
                  <th className="px-3 py-3 text-left font-semibold">
                    Paid views
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">
                    Tổng paid views
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">
                    % đóng góp
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">
                    Doanh thu nhận
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center">
                      Đang tải...
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-gray-500"
                    >
                      Chưa có dữ liệu doanh thu.
                    </td>
                  </tr>
                )}

                {!loading &&
                  items.map((item) => (
                    <tr key={item._id} className="border-t align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900">
                          {item.authorId?.name || "Không rõ"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.authorId?.email}
                        </div>
                      </td>

                      <td className="px-3 py-3">{item.month}</td>
                      <td className="px-3 py-3">{item.paidViews}</td>
                      <td className="px-3 py-3">{item.totalPaidViews}</td>
                      <td className="px-3 py-3">{item.sharePercent}%</td>

                      <td className="px-3 py-3 font-semibold text-green-700">
                        {money(item.amount)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* YÊU CẦU RÚT TIỀN */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b bg-white px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Yêu cầu rút tiền của tác giả
              </h2>
            </div>

            <select
              value={withdrawalStatus}
              onChange={(e) => setWithdrawalStatus(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2 text-sm"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Đang chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="paid">Đã thanh toán</option>
              <option value="rejected">Đã từ chối</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Tác giả</th>
                  <th className="px-3 py-3 text-left font-semibold">
                    Số tiền rút
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">
                    Số dư ví
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">
                    Ngân hàng
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">
                    Số tài khoản
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">
                    Chủ tài khoản
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">
                    Trạng thái
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">
                    Ngày gửi
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">
                    Thao tác
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center">
                      Đang tải...
                    </td>
                  </tr>
                )}

                {!loading && withdrawals.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-8 text-center text-gray-500"
                    >
                      Chưa có yêu cầu rút tiền.
                    </td>
                  </tr>
                )}

                {!loading &&
                  withdrawals.map((item) => (
                    <tr key={item._id} className="border-t align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900">
                          {item.authorId?.name || "Không rõ"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.authorId?.email}
                        </div>
                      </td>

                      <td className="px-3 py-3 font-semibold text-green-700">
                        {money(item.amount)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-blue-700">
                        {money(item.walletBalance)}
                      </td>
                      <td className="px-3 py-3">{item.bankName}</td>

                      <td className="px-3 py-3 font-mono">
                        {item.bankAccount}
                      </td>

                      <td className="px-3 py-3">{item.bankHolder}</td>

                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${withdrawalStatusClass(
                            item.status
                          )}`}
                        >
                          {withdrawalStatusText(item.status)}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-gray-600">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString("vi-VN")
                          : "—"}
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          {item.status === "pending" && (
                            <>
                              <button
                                onClick={() => approveWithdrawal(item._id)}
                                className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                              >
                                Duyệt
                              </button>

                              <button
                                onClick={() => rejectWithdrawal(item._id)}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                              >
                                Từ chối
                              </button>
                            </>
                          )}

                          {["pending", "approved"].includes(item.status) && (
                            <button
                              onClick={() => markWithdrawalPaid(item._id)}
                              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                            >
                              Đã thanh toán
                            </button>
                          )}

                          {["paid", "rejected"].includes(item.status) && (
                            <span className="text-xs text-gray-400">
                              Không có
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}