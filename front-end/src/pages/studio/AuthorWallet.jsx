import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
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

export default function AuthorWallet() {
  const [summary, setSummary] = useState(null);
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [form, setForm] = useState({
    amount: "",
    bankName: "",
    bankAccount: "",
    bankHolder: "",
    note: "",
  });

  const availableBalance = Number(summary?.availableBalance || 0);

  const canSubmit = useMemo(() => {
    return (
      Number(form.amount || 0) > 0 &&
      form.bankName.trim() &&
      form.bankAccount.trim() &&
      form.bankHolder.trim()
    );
  }, [form]);

  async function load() {
    setLoading(true);

    try {
      const [walletRes, withdrawalsRes] = await Promise.all([
        api.authorWallet.getWallet(),
        api.authorWallet.listWithdrawals(),
      ]);

      setSummary(walletRes.summary || {});
      setMonthlyRows(Array.isArray(walletRes.monthlyRows) ? walletRes.monthlyRows : []);
      setWithdrawals(
        Array.isArray(withdrawalsRes.items) ? withdrawalsRes.items : []
      );
    } catch (e) {
      alert(e.message || "Không thể tải ví tác giả.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitWithdrawal(e) {
    e.preventDefault();

    if (!canSubmit) {
      alert("Vui lòng nhập đầy đủ thông tin rút tiền.");
      return;
    }

    if (Number(form.amount) > availableBalance) {
      alert("Số tiền rút vượt quá số dư khả dụng.");
      return;
    }

    setSending(true);

    try {
      await api.authorWallet.createWithdrawal({
        amount: Number(form.amount),
        bankName: form.bankName,
        bankAccount: form.bankAccount,
        bankHolder: form.bankHolder,
        note: form.note,
      });

      alert("Đã gửi yêu cầu rút tiền.");

      setForm({
        amount: "",
        bankName: "",
        bankAccount: "",
        bankHolder: "",
        note: "",
      });

      await load();
    } catch (e) {
      alert(e.message || "Không thể gửi yêu cầu rút tiền.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Header />

      <main className="min-h-screen bg-gradient-to-b from-purple-50 via-white to-pink-50">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Ví tác giả
                </span>
              </h1>

              <p className="mt-2 text-sm text-gray-600">
                Doanh thu chương được chia 50% cho tác giả và 50% cho nền tảng.
              </p>
            </div>

            <Link
              to="/studio"
              className="inline-flex items-center justify-center rounded-xl border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-purple-50"
            >
              ← Quay lại
            </Link>
          </div>

          {loading ? (
            <div className="rounded-3xl border bg-white p-8 text-gray-500 shadow-sm">
              Đang tải ví tác giả...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-3xl border bg-white p-5 shadow-sm">
                  <div className="text-sm font-bold text-gray-500">Tổng tiền được nhận</div>
                  <div className="mt-2 text-3xl font-bold text-green-700">
                    {money(summary?.totalAuthorRevenue)}
                  </div>
            
                </div>

                <div className="rounded-3xl border bg-white p-5 shadow-sm">
                  <div className="text-sm font-bold text-gray-500">Số dư khả dụng</div>
                  <div className="mt-2 text-3xl font-bold text-purple-700">
                    {money(summary?.availableBalance)}
                  </div>
                </div>

                <div className="rounded-3xl border bg-white p-5 shadow-sm">
                  <div className="text-sm font-bold text-gray-500">Đang chờ xử lý</div>
                  <div className="mt-2 text-3xl font-bold text-amber-700">
                    {money(summary?.pendingAmount)}
                  </div>
                </div>

                <div className="rounded-3xl border bg-white p-5 shadow-sm">
                  <div className="text-sm font-bold text-gray-500">Đã thanh toán</div>
                  <div className="mt-2 text-3xl font-bold text-gray-900">
                    {money(summary?.paidAmount)}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
                <div className="rounded-3xl border bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-gray-900">
                    Doanh thu theo tháng
                  </h2>

                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left">Tháng</th>
                          <th className="px-3 py-3 text-left">Lượt đọc VIP</th>
                          <th className="px-3 py-3 text-left">Doanh thu gốc</th>
                          <th className="px-3 py-3 text-left">Tác giả nhận</th>
                          <th className="px-3 py-3 text-left">Nền tảng</th>
                        </tr>
                      </thead>

                      <tbody>
                        {monthlyRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-3 py-8 text-center text-gray-400"
                            >
                              Chưa có dữ liệu doanh thu.
                            </td>
                          </tr>
                        ) : (
                          monthlyRows.map((row) => (
                            <tr key={row._id} className="border-t">
                              <td className="px-3 py-3 font-medium">
                                {row.month}
                              </td>
                              <td className="px-3 py-3">
                                {row.paidViews || 0}
                              </td>
                              <td className="px-3 py-3">
                                {money(row.grossRevenue)}
                              </td>
                              <td className="px-3 py-3 font-semibold text-green-700">
                                {money(row.amount)}
                              </td>
                              <td className="px-3 py-3 text-gray-600">
                                {money(
                                  Number(row.grossRevenue || 0) -
                                    Number(row.amount || 0)
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <form
                  onSubmit={submitWithdrawal}
                  className="rounded-3xl border bg-white p-5 shadow-sm"
                >
                  <h2 className="text-lg font-bold text-gray-900">
                    Yêu cầu rút tiền
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Số dư hiện có:{" "}
                    <b className="text-purple-700">
                      {money(availableBalance)}
                    </b>
                  </p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Số tiền muốn rút
                      </label>
                      <input
                        type="number"
                        min="1000"
                        value={form.amount}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            amount: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        placeholder="VD: 50000"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Ngân hàng
                      </label>
                      <input
                        value={form.bankName}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            bankName: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        placeholder="VD: Vietcombank"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Số tài khoản
                      </label>
                      <input
                        value={form.bankAccount}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            bankAccount: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        placeholder="VD: 0123456789"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Tên chủ tài khoản
                      </label>
                      <input
                        value={form.bankHolder}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            bankHolder: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        placeholder="VD: NGUYEN VAN A"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Ghi chú
                      </label>
                      <textarea
                        rows={3}
                        value={form.note}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            note: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        placeholder=" "
                      />
                    </div>

                    <button
                      disabled={sending || !canSubmit}
                      className="w-full rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sending ? "Đang gửi..." : "Gửi yêu cầu rút tiền"}
                    </button>
                  </div>
                </form>
              </div>

              <div className="mt-6 rounded-3xl border bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900">
                  Lịch sử yêu cầu rút tiền
                </h2>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left">Ngày gửi</th>
                        <th className="px-3 py-3 text-left">Số tiền</th>
                        <th className="px-3 py-3 text-left">Ngân hàng</th>
                        <th className="px-3 py-3 text-left">Số tài khoản</th>
                        <th className="px-3 py-3 text-left">Trạng thái</th>
                      </tr>
                    </thead>

                    <tbody>
                      {withdrawals.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-8 text-center text-gray-400"
                          >
                            Chưa có yêu cầu rút tiền.
                          </td>
                        </tr>
                      ) : (
                        withdrawals.map((item) => (
                          <tr key={item._id} className="border-t">
                            <td className="px-3 py-3">
                              {new Date(item.createdAt).toLocaleString("vi-VN")}
                            </td>
                            <td className="px-3 py-3 font-semibold">
                              {money(item.amount)}
                            </td>
                            <td className="px-3 py-3">{item.bankName}</td>
                            <td className="px-3 py-3">{item.bankAccount}</td>
                            <td className="px-3 py-3">
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                                  item.status
                                )}`}
                              >
                                {statusText(item.status)}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}