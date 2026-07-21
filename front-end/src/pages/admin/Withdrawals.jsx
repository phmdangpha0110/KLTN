import { useEffect, useState } from "react";
import AdminHeader from "../../components/admin/AdminHeader";
import { api } from "../../lib/api";

function money(v) {
  return Number(v || 0).toLocaleString("vi-VN") + "đ";
}

function statusText(status) {
  if (status === "approved") return "Đã duyệt";
  if (status === "paid") return "Đã thanh toán";
  if (status === "rejected") return "Từ chối";
  return "Đang chờ";
}

function statusClass(status) {
  if (status === "paid") return "bg-green-50 text-green-700";
  if (status === "approved") return "bg-blue-50 text-blue-700";
  if (status === "rejected") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

export default function Withdrawals() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);

    try {
      const res = await api.adminWithdrawals.list({ status });
      setItems(Array.isArray(res.items) ? res.items : []);
    } catch (e) {
      alert(e.message || "Không thể tải yêu cầu rút tiền.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  async function action(id, type) {
    try {
      if (type === "approve") {
        await api.adminWithdrawals.approve(id);
        alert("Đã duyệt yêu cầu.");
      }

      if (type === "reject") {
        const reason = window.prompt("Nhập lý do từ chối:", "");
        await api.adminWithdrawals.reject(id, { adminNote: reason || "" });
        alert("Đã từ chối yêu cầu.");
      }

      if (type === "paid") {
        await api.adminWithdrawals.markPaid(id);
        alert("Đã đánh dấu đã thanh toán.");
      }

      await load();
    } catch (e) {
      alert(e.message || "Không thể xử lý yêu cầu.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Yêu cầu rút tiền
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Admin kiểm tra thông tin ngân hàng, chuyển khoản thủ công rồi đánh dấu đã thanh toán.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border bg-white px-3 py-2 text-sm"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Đang chờ</option>
              <option value="approved">Đã duyệt</option>
              <option value="paid">Đã thanh toán</option>
              <option value="rejected">Từ chối</option>
            </select>

            <button
              onClick={load}
              disabled={loading}
              className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "Đang tải..." : "↺ Làm mới"}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Tác giả</th>
                  <th className="px-3 py-3 text-left font-semibold">Số tiền</th>
                  <th className="px-3 py-3 text-left font-semibold">Ngân hàng</th>
                  <th className="px-3 py-3 text-left font-semibold">Số tài khoản</th>
                  <th className="px-3 py-3 text-left font-semibold">Chủ tài khoản</th>
                  <th className="px-3 py-3 text-left font-semibold">Trạng thái</th>
                  <th className="px-3 py-3 text-left font-semibold">Ngày gửi</th>
                  <th className="px-3 py-3 text-right font-semibold">Hành động</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                      Đang tải...
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                      Chưa có yêu cầu rút tiền.
                    </td>
                  </tr>
                )}

                {!loading &&
                  items.map((item) => (
                    <tr key={item._id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <div className="font-semibold text-gray-900">
                          {item.authorId?.name || "Không rõ"}
                        </div>
                        <div className="text-xs text-gray-500">
                          {item.authorId?.email || ""}
                        </div>
                      </td>

                      <td className="px-3 py-3 font-bold text-green-700">
                        {money(item.amount)}
                      </td>

                      <td className="px-3 py-3">{item.bankName}</td>
                      <td className="px-3 py-3 font-mono">{item.bankAccount}</td>
                      <td className="px-3 py-3">{item.bankHolder}</td>

                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                            item.status
                          )}`}
                        >
                          {statusText(item.status)}
                        </span>
                      </td>

                      <td className="px-3 py-3 text-gray-600">
                        {new Date(item.createdAt).toLocaleString("vi-VN")}
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          {item.status === "pending" && (
                            <>
                              <button
                                onClick={() => action(item._id, "approve")}
                                className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                              >
                                Duyệt
                              </button>

                              <button
                                onClick={() => action(item._id, "reject")}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                              >
                                Từ chối
                              </button>
                            </>
                          )}

                          {["pending", "approved"].includes(item.status) && (
                            <button
                              onClick={() => action(item._id, "paid")}
                              className="rounded-lg border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50"
                            >
                              Đã thanh toán
                            </button>
                          )}

                          {["paid", "rejected"].includes(item.status) && (
                            <span className="text-xs text-gray-400">
                              Không còn thao tác
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
      </main>
    </div>
  );
}