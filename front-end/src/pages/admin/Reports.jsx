// src/pages/admin/Reports.jsx
import React, { useEffect, useState } from "react";
import AdminHeader from "../../components/admin/AdminHeader";
import { api } from "../../lib/api";

const STATUS_LABELS = {
  pending: "Chờ xử lý",
  reviewing: "Đang xem xét",
  resolved: "Đã xử lý",
  rejected: "Đã từ chối",
};

function getStatusClass(status) {
  switch (status) {
    case "pending":
      return "bg-red-100 text-red-700 border-red-300";

    case "reviewing":
      return "bg-yellow-100 text-yellow-700 border-yellow-300";

    case "resolved":
      return "bg-green-100 text-green-700 border-green-300";

    case "rejected":
      return "bg-gray-100 text-gray-600 border-gray-300";

    default:
      return "bg-slate-100 text-slate-600 border-slate-300";
  }
}

const TYPE_LABELS = {
  novel: "Truyện",
  chapter: "Chương",
  comment: "Bình luận",
  other: "Khác",
};

const DECISIONS = [
  {
    key: "requestEdit",
    label: "Mức 1: Yêu cầu chỉnh sửa",
    desc: "Gửi thông báo yêu cầu tác giả chỉnh sửa nội dung vi phạm trong thời hạn nhất định.",
  },
  {
    key: "deleteContent",
    label: "Mức 2: Xoá nội dung vi phạm",
    desc: "Xóa truyện, chương hoặc bình luận bị báo cáo khỏi hệ thống.",
  },
  {
    key: "banPosting",
    label: "Mức 3: Cấm đăng bài tạm thời",
    desc: "Cấm tác giả đăng truyện/chương trong 3, 7, 14 hoặc 30 ngày.",
  },
  {
    key: "markResolved",
    label: "Đánh dấu đã xử lý",
    desc: "Tác giả đã chỉnh sửa xong và nội dung không còn vi phạm.",
  },
  {
    key: "reject",
    label: "Từ chối báo cáo",
    desc: "Báo cáo là không hợp lệ hoặc chưa đủ căn cứ xử lý.",
  },
];

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [selectedReportId, setSelectedReportId] = useState(null);
  const [selectedReportDetail, setSelectedReportDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [decision, setDecision] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const [editDeadline, setEditDeadline] = useState("");
  const [banDays, setBanDays] = useState(7);

  useEffect(() => {
    let mounted = true;

    async function loadReports() {
      setLoading(true);
      setErr("");

      try {
        const res = await api.admin.reports.list();

        const list = Array.isArray(res.items)
          ? res.items
          : Array.isArray(res.data?.items)
          ? res.data.items
          : [];

        if (mounted) {
          setReports(list);
        }
      } catch (e) {
        console.error("[AdminReports] load list error:", e);

        if (mounted) {
          setErr(e.message || "Không thể tải danh sách báo cáo.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadReports();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedReportId) {
      setSelectedReportDetail(null);
      setDecision("");
      setAdminNote("");
      setDetailLoading(false);
      setEditDeadline("");
      setBanDays(7);
      return;
    }

    let mounted = true;

    async function loadDetail() {
      setDetailLoading(true);

      try {
        const res = await api.admin.reports.detail(selectedReportId);

        if (mounted) {
          setSelectedReportDetail(res.report || res.data?.report || null);
        }
      } catch (e) {
        console.error("[AdminReports] load detail error:", e);
      } finally {
        if (mounted) setDetailLoading(false);
      }
    }

    loadDetail();

    return () => {
      mounted = false;
    };
  }, [selectedReportId]);

  function formatDate(d) {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString();
  }

  function getDecisionStatus(nextDecision) {
    if (nextDecision === "reject") return "rejected";
    if (nextDecision === "requestEdit") return "reviewing";
    return "resolved";
  }

  function getDecisionLastAction(nextDecision) {
    if (nextDecision === "requestEdit") return "request_edit";
    if (nextDecision === "deleteContent") return "delete";
    if (nextDecision === "banPosting") return "ban_posting";
    if (nextDecision === "markResolved") return "mark_resolved";
    if (nextDecision === "reject") return "reject";
    return null;
  }

  async function handleActionSubmit(e) {
    e.preventDefault();

    if (!selectedReportId) return;

    if (!decision) {
      alert("Vui lòng chọn 1 hình thức xử lý.");
      return;
    }

    try {
      setProcessing(true);

      await api.admin.reports.action(selectedReportId, {
        decision,
        adminNote: adminNote.trim() || undefined,
        editDeadline:
          decision === "requestEdit" ? editDeadline || undefined : undefined,
        banDays: decision === "banPosting" ? Number(banDays) : undefined,
      });

      const nextStatus = getDecisionStatus(decision);
      const nextLastAction = getDecisionLastAction(decision);

      setReports((prev) =>
        prev.map((r) =>
          String(r._id) === String(selectedReportId)
            ? {
                ...r,
                status: nextStatus,
                lastAction: nextLastAction,
                adminNote: adminNote.trim() || r.adminNote,
                resolvedAt:
                  nextStatus === "resolved" || nextStatus === "rejected"
                    ? new Date().toISOString()
                    : r.resolvedAt,
              }
            : r
        )
      );

      alert("Đã xử lý báo cáo.");

      setDecision("");
      setAdminNote("");

      try {
        const res = await api.admin.reports.detail(selectedReportId);
        setSelectedReportDetail(res.report || res.data?.report || null);
      } catch {
        // Không ảnh hưởng chức năng xử lý nếu reload detail thất bại
      }
    } catch (e) {
      console.error("[AdminReports] action error:", e);
      alert(e.message || "Có lỗi xảy ra khi xử lý báo cáo.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Quản lý báo cáo vi phạm" />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {err && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="overflow-hidden rounded-md border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-lg font-semibold">Danh sách báo cáo</h2>

            {loading && (
              <span className="text-xs text-gray-500">Đang tải...</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">ID</th>
                  <th className="px-3 py-2 text-left font-medium">Loại</th>
                  <th className="px-3 py-2 text-left font-medium">Nguồn</th>
                  <th className="px-3 py-2 text-left font-medium">Lý do</th>
                  <th className="px-3 py-2 text-left font-medium">
                    Trạng thái
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Ngày tạo</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Thao tác
                  </th>
                </tr>
              </thead>

              <tbody>
                {!loading && reports.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-4 text-center text-gray-500"
                    >
                      Chưa có báo cáo nào.
                    </td>
                  </tr>
                )}

                {reports.map((r) => {
                  const isSelected =
                    selectedReportId &&
                    String(selectedReportId) === String(r._id);

                  return (
                    <tr
                      key={r._id}
                      className={
                        "border-t hover:bg-gray-50 " +
                        (isSelected ? "bg-blue-50" : "")
                      }
                    >
                      <td className="break-all px-3 py-2 align-top text-xs">
                        {r._id}
                      </td>

                      <td className="px-3 py-2 align-top">
                        {TYPE_LABELS[r.type] || r.type}
                      </td>

                      <td className="px-3 py-2 align-top">
                        {r.source === "ai" ? (
                          <span className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-700">
                            AI phát hiện
                          </span>
                        ) : (
                          <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                            Người dùng báo cáo
                          </span>
                        )}
                      </td>

                      <td className="max-w-xs px-3 py-2 align-top">
                        <div className="line-clamp-2">
                          {r.reason || <span className="text-gray-400">—</span>}
                        </div>
                      </td>

                      <td className="px-3 py-2 align-top">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusClass(
                            r.status
                          )}`}
                        >
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </td>

                      <td className="px-3 py-2 align-top">
                        {formatDate(r.createdAt)}
                      </td>

                      <td className="px-3 py-2 text-right align-top">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedReportId(
                              String(selectedReportId) === String(r._id)
                                ? null
                                : r._id
                            )
                          }
                          className="rounded border bg-white px-3 py-1 text-xs hover:bg-gray-100"
                        >
                          {isSelected ? "Đóng" : "Xử lý"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {selectedReportId && (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-md border bg-white p-4 shadow-sm">
              <h3 className="mb-3 font-semibold">Chi tiết báo cáo</h3>

              {detailLoading && (
                <p className="text-sm text-gray-500">Đang tải chi tiết...</p>
              )}

              {!detailLoading && selectedReportDetail && (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">ID: </span>
                    <span className="break-all">
                      {selectedReportDetail._id}
                    </span>
                  </div>

                  <div>
                    <span className="font-medium">Loại: </span>
                    {TYPE_LABELS[selectedReportDetail.type] ||
                      selectedReportDetail.type}
                  </div>

                  {selectedReportDetail.novelId && (
                    <div className="space-y-1">
                      <div>
                        <span className="font-medium">Truyện: </span>

                        {typeof selectedReportDetail.novelId === "object" ? (
                          <>
                            <span>
                              {selectedReportDetail.novelId.title ||
                                selectedReportDetail.novelId._id}
                            </span>

                            <a
                              href={`/novel/${selectedReportDetail.novelId._id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 text-blue-600 underline hover:font-bold"
                            >
                              Xem tác phẩm
                            </a>
                          </>
                        ) : (
                          <>
                            <span>{selectedReportDetail.novelId}</span>

                            <a
                              href={`/novel/${selectedReportDetail.novelId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 text-blue-600 underline hover:font-bold"
                            >
                              Xem tác phẩm
                            </a>
                          </>
                        )}
                      </div>

                      {selectedReportDetail.type === "chapter" &&
                        selectedReportDetail.chapterNo != null && (
                          <div>
                            <a
                              href={`/novel/${
                                typeof selectedReportDetail.novelId ===
                                "object"
                                  ? selectedReportDetail.novelId._id
                                  : selectedReportDetail.novelId
                              }/chuong/${selectedReportDetail.chapterNo}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-red-600 underline hover:font-bold"
                            >
                              Xem chương bị báo cáo
                            </a>
                          </div>
                        )}
                    </div>
                  )}

                  {selectedReportDetail.chapterNo != null &&
                    selectedReportDetail.type === "chapter" && (
                      <div>
                        <span className="font-medium">Chương: </span>
                        {selectedReportDetail.chapterNo}
                      </div>
                    )}

                  {selectedReportDetail.commentId &&
                    selectedReportDetail.type === "comment" && (
                      <div>
                        <span className="font-medium">Bình luận ID: </span>
                        {typeof selectedReportDetail.commentId === "object"
                          ? selectedReportDetail.commentId._id
                          : selectedReportDetail.commentId}
                      </div>
                    )}

                  <div>
                    <span className="font-medium">Người báo cáo: </span>
                    {selectedReportDetail.userId
                      ? selectedReportDetail.userId.name ||
                        selectedReportDetail.userId.email ||
                        selectedReportDetail.userId._id
                      : "Ẩn danh / không xác định"}
                  </div>

                  <div>
                    <span className="font-medium">Lý do: </span>
                    {selectedReportDetail.reason || "—"}
                  </div>

                  <div>
                    <span className="font-medium">Mô tả: </span>
                    <p className="whitespace-pre-line">
                      {selectedReportDetail.description || "—"}
                    </p>
                  </div>

                  <div>
                    <span className="font-medium">Trạng thái: </span>

                    <span
                      className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusClass(
                        selectedReportDetail.status
                      )}`}
                    >
                      {STATUS_LABELS[selectedReportDetail.status] ||
                        selectedReportDetail.status}
                    </span>
                  </div>

                  {selectedReportDetail.adminNote && (
                    <div>
                      <span className="font-medium">Ghi chú: </span>
                      <p className="whitespace-pre-line">
                        {selectedReportDetail.adminNote}
                      </p>
                    </div>
                  )}

                  {selectedReportDetail.resolvedAt && (
                    <div>
                      <span className="font-medium">Thời gian xử lý: </span>
                      {formatDate(selectedReportDetail.resolvedAt)}
                    </div>
                  )}

                  {selectedReportDetail.source === "ai" && (
                    <div className="rounded border border-purple-200 bg-purple-50 p-3">
                      <div className="font-medium text-purple-800">
                        Kết quả kiểm duyệt AI
                      </div>

                      <div className="mt-1 text-sm">
                        Nhóm nghi vi phạm:{" "}
                        {selectedReportDetail.aiModeration?.flaggedCategories
                          ?.length
                          ? selectedReportDetail.aiModeration.flaggedCategories.join(
                              ", "
                            )
                          : "Không rõ"}
                      </div>

                      <div className="mt-1 text-xs text-gray-600">
                        Lưu ý: AI chỉ hỗ trợ phát hiện ban đầu. Admin là người
                        kết luận cuối cùng.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-md border bg-white p-4 shadow-sm">
              <h3 className="mb-3 font-semibold">Xử lý báo cáo</h3>

              <form onSubmit={handleActionSubmit} className="space-y-3">
                <div className="space-y-2">
                  {DECISIONS.map((d) => (
                    <label
                      key={d.key}
                      className={
                        "flex cursor-pointer items-start gap-2 rounded border px-3 py-2 hover:bg-gray-50 " +
                        (decision === d.key
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200")
                      }
                    >
                      <input
                        type="radio"
                        className="mt-1"
                        name="decision"
                        value={d.key}
                        checked={decision === d.key}
                        onChange={() => setDecision(d.key)}
                      />

                      <div>
                        <div className="text-sm font-medium">{d.label}</div>
                        <div className="text-xs text-gray-500">{d.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Ghi chú
                  </label>

                  <textarea
                    rows={3}
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder=" "
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                </div>

                {decision === "requestEdit" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Hạn chỉnh sửa
                    </label>

                    <input
                      type="datetime-local"
                      value={editDeadline}
                      onChange={(e) => setEditDeadline(e.target.value)}
                      className="w-full rounded border px-3 py-2 text-sm"
                    />

                    <p className="mt-1 text-xs text-gray-500">
                      Nếu bỏ trống, hệ thống mặc định cho tác giả 3 ngày để chỉnh
                      sửa.
                    </p>
                  </div>
                )}

                {decision === "banPosting" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Thời hạn cấm đăng bài
                    </label>

                    <select
                      value={banDays}
                      onChange={(e) => setBanDays(Number(e.target.value))}
                      className="w-full rounded border px-3 py-2 text-sm"
                    >
                      <option value={3}>3 ngày</option>
                      <option value={7}>7 ngày</option>
                      <option value={14}>14 ngày</option>
                      <option value={30}>30 ngày</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    className="text-xs text-red-600 underline hover:font-bold"
                    onClick={() => setSelectedReportId(null)}
                    disabled={processing}
                  >
                    Đóng
                  </button>

                  <button
                    type="submit"
                    disabled={processing || !decision}
                    className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:font-bold disabled:opacity-60"
                  >
                    {processing ? "Đang xử lý..." : "Xác nhận xử lý"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}