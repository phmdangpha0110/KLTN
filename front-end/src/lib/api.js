// src/lib/api.js

// Lấy base URL từ env (Vite: import.meta.env.VITE_API_BASE)
const ENV_BASE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) ||
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_BASE) ||
  "";

export const API_BASE = ENV_BASE || "";

const TOKEN_KEY = "authToken";

// ===== Token helpers =====
function setToken(t) {
  if (!t) return;
  localStorage.setItem(TOKEN_KEY, t);
}
function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ===== Core request helpers =====
function buildUrl(path, params = {}) {
  const u = new URL(path, API_BASE || window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    u.searchParams.set(k, v);
  });
  return u.toString();
}

async function request(path, { method = "GET", body, auth = false, params } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const tk = getToken();
    if (tk) headers["Authorization"] = `Bearer ${tk}`;
  }

  const url = params ? buildUrl(path, params) : buildUrl(path);

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

if (!res.ok) {
  const msg = data?.message || data?.error || `HTTP ${res.status}`;

  const err = new Error(msg);
  err.status = res.status;
  err.data = data;
  err.moderation = data?.moderation;

  throw err;
}

return data;
}

const getJSON = (p, params) =>
  request(p + (params ? "?" + new URLSearchParams(params) : ""), {
    method: "GET",
    auth: false,
  });

// ===== Public API =====
export const api = {
  request,

  // demo content endpoints available in your project
  getGenres() {
    return getJSON("/api/genres");
  },

  getPosters() {
    return getJSON("/api/posters");
  },

  getTopReadNovels() {
    return request("/api/novels/ranking/top-read", {
      method: "GET",
    });
  },

  getLatestNovels() {
    return request("/api/novels/ranking/latest", {
      method: "GET",
    });
  },

  getLatestChapterUpdates() {
    return request("/api/chapters/latest-updates", {
      method: "GET",
    });
  },

  getNovelsByGenre({ genre, limit, q }) {
    return getJSON("/api/novels", { genre, limit, q });
  },

  chatbot: {
    ask(message) {
      return request("/api/chatbot", {
        method: "POST",
        body: { message },
      });
    },
  },

  // ===== Auth group =====
  auth: {
    // Đăng nhập: { email, password } -> { token, user }
    async login({ email, password }) {
      const data = await request("/api/users/login", {
        method: "POST",
        body: { email, password },
      });

      // Chuẩn hoá theo backend: token có thể là data.token hoặc data.accessToken
      const token = data.token || data.accessToken;
      if (!token) throw new Error("Không nhận được token từ máy chủ.");
      setToken(token);

      // Lưu quick-view user (nếu backend trả về)
      if (data.user) {
        localStorage.setItem("sessionUser", JSON.stringify(data.user));
      }

      return data;
    },

    // ===== GOOGLE LOGIN (MỚI THÊM) =====
    // Đăng nhập bằng Google: nhận idToken từ Google Identity, gọi /api/auth/google
    async loginWithGoogle(idToken) {
      const data = await request("/api/auth/google", {
        method: "POST",
        body: { idToken },
      });

      const token = data.token || data.accessToken;
      if (!token) throw new Error("Không nhận được token từ máy chủ.");

      // 💡 NOTE (VIỆT): Dùng chung cơ chế lưu token hiện tại
      setToken(token);

      if (data.user) {
        localStorage.setItem("sessionUser", JSON.stringify(data.user));
      }

      return data;
    },
    // ===== HẾT PHẦN GOOGLE LOGIN MỚI THÊM =====

    // Lấy hồ sơ người dùng hiện tại (dựa vào token)
    async me() {
      const data = await request("/api/users/me", {
        method: "GET",
        auth: true,
      });

      return data;
    },

    // ===== THÊM MỚI: Đăng ký qua /api/auth/register =====
    async register({ name, email, password }) {
      // endpoint chuẩn mới
      const data = await request("/api/auth/register", {
        method: "POST",
        body: { name, email, password },
      });

      // nếu backend trả token thì lưu luôn
      const token = data.token || data.accessToken;
      if (token) setToken(token);

      if (data.user) {
        localStorage.setItem("sessionUser", JSON.stringify(data.user));
      }

      return data;
    },

    // ===== THÊM MỚI (ALIAS): Đăng nhập qua /api/auth/login =====
    // Giữ nguyên login cũ (/api/users/login); hàm này là lựa chọn thêm
    async loginAuth({ email, password }) {
      const data = await request("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });

      const token = data.token || data.accessToken;
      if (!token) throw new Error("Không nhận được token từ máy chủ.");

      setToken(token);

      if (data.user) {
        localStorage.setItem("sessionUser", JSON.stringify(data.user));
      }

      return data;
    },

    // ===== THÊM MỚI (ALIAS): Lấy hồ sơ qua /api/auth/me =====
    async meAuth() {
      return request("/api/auth/me", {
        method: "GET",
        auth: true,
      });
    },

    logout() {
      clearToken();
      localStorage.removeItem("sessionUser");
    },

    getToken,
  },

  // ===== THÊM MỚI: Users group cho trang chỉnh sửa hồ sơ =====
  users: {
    // Lấy hồ sơ theo id (có auth)
    getById(id) {
      return request(`/api/users/${id}`, {
        auth: true,
      });
    },

    // Lấy hồ sơ chính mình (alias – nếu backend hỗ trợ)
    me() {
      return request("/api/users/me", {
        auth: true,
      });
    },

    // Cập nhật theo id
    update(id, body) {
      return request(`/api/users/${id}`, {
        method: "PUT",
        body,
        auth: true,
      });
    },

    // Cập nhật chính mình (nếu backend có /me)
    updateMe(body) {
      return request("/api/users/me", {
        method: "PUT",
        body,
        auth: true,
      });
    },
  },

  // ===== Author Studio (thêm mới, cập nhật) =====
  studio: {
    async createNovel(payload) {
      return request("/api/novels", {
        method: "POST",
        body: payload,
        auth: true,
      });
    },

    async updateNovel(id, payload) {
      return request(`/api/novels/${id}`, {
        method: "PUT",
        body: payload,
        auth: true,
      });
    },

    async deleteNovel(id) {
      return request(`/api/novels/${id}`, {
        method: "DELETE",
        auth: true,
      });
    },

    async getChapter(id) {
      return request(`/api/chapters/${id}`, {
        method: "GET",
        auth: true,
      });
    },

    async createChapter(payload) {
      return request("/api/chapters", {
        method: "POST",
        body: payload,
        auth: true,
      });
    },

    async updateChapter(id, payload) {
      return request(`/api/chapters/${id}`, {
        method: "PUT",
        body: payload,
        auth: true,
      });
    },

    async deleteChapter(id) {
      return request(`/api/chapters/${id}`, {
        method: "DELETE",
        auth: true,
      });
    },
  },

  async isVip() {
    try {
      const me = await request("/api/users/me", {
        method: "GET",
        auth: true,
      });

      // Nếu có vipUntil thì phải kiểm tra hạn.
      // Không được chỉ dựa vào isVip vì DB cũ có thể còn true sau khi hết hạn.
      if (me?.vipUntil) {
        const until = new Date(me.vipUntil);
        return !Number.isNaN(until.getTime()) && until > new Date();
      }

      return Boolean(me?.isVip);
    } catch {
      return false;
    }
  },

  authorWallet: {
    getWallet() {
      return request("/api/author/wallet", {
        method: "GET",
        auth: true,
      });
    },

    listWithdrawals() {
      return request("/api/author/withdrawals", {
        method: "GET",
        auth: true,
      });
    },

    createWithdrawal(body) {
      return request("/api/author/withdrawals", {
        method: "POST",
        auth: true,
        body,
      });
    },
  },

  vip: {
    async spin() {
      return request("/api/vip/spin", {
        method: "POST",
        auth: true,
      });
    },

    async redeem(code) {
      return request("/api/vip/redeem", {
        method: "POST",
        body: { code },
        auth: true,
      });
    },

    async buy(plan) {
      return request("/api/vip/buy", {
        method: "POST",
        body: { plan },
        auth: true,
      });
    },

    async generateTestCode(days = 1) {
      return request("/api/vip/dev/generate-code", {
        method: "POST",
        body: { days },
        auth: true,
      });
    },

    status(orderId) {
      return request(`/api/vip/status/${orderId}`, {
        method: "GET",
        auth: true,
      });
    },
  },

  authors: {
    // GET /api/authors
    // params: { q, country, genres, sort, page, pageSize }
    list(params = {}) {
      return request("/api/authors", {
        method: "GET",
        params,
      });
    },

    // GET /api/authors/:id
    detail(id) {
      return request(`/api/authors/${id}`, {
        method: "GET",
      });
    },

    /**
     * GET /api/authors/following/list
     * Backend dùng req.userId (từ token), không nhận userId qua query/body
     * → cần auth: true
     * → trả về { followAuthors: [...] } (đã populate name, avatar, bio)
     */
    async following() {
      return request("/api/authors/following/list", {
        method: "GET",
        auth: true,
      });
    },

    /**
     * POST /api/authors/:id/follow
     * Backend dùng req.userId, không cần gửi userId trong body
     * → trả về { message, isFollowing, followersCount, followAuthors }
     */
    async follow(authorId) {
      return request(`/api/authors/${authorId}/follow`, {
        method: "POST",
        auth: true,
      });
    },

    /**
     * POST /api/authors/:id/unfollow
     * Backend dùng req.userId
     * → trả về { message, isFollowing: false, followersCount, followAuthors }
     */
    async unfollow(authorId) {
      return request(`/api/authors/${authorId}/unfollow`, {
        method: "POST",
        auth: true,
      });
    },

    /**
     * NEW: POST /api/authors/:id/toggle
     * (đã thêm trong routes/followAuthors.js)
     * Nếu đang follow → bỏ
     * Nếu chưa follow → follow
     * → trả về { message, isFollowing, followersCount, followAuthors }
     */
    async toggleFollow(authorId) {
      return request(`/api/authors/${authorId}/toggle`, {
        method: "POST",
        auth: true,
      });
    },

    // Lấy truyện của 1 tác giả – nếu backend có hỗ trợ ?authorId=
    novels(authorId) {
      return request("/api/novels", {
        method: "GET",
        params: { authorId },
      });
    },
  },

  // ===== Thông báo phía user =====
  notifications: {
    // GET /api/notifications -> danh sách thông báo của chính user
    async list() {
      return request("/api/notifications", {
        method: "GET",
        auth: true,
      });
    },

    // POST /api/notifications/read-all
    async markAllRead() {
      return request("/api/notifications/read-all", {
        method: "POST",
        auth: true,
      });
    },

    // POST /api/notifications/:id/read
    async markRead(id) {
      return request(`/api/notifications/${id}/read`, {
        method: "POST",
        auth: true,
      });
    },
  },

  // ----- BÁO CÁO VI PHẠM (USER) -----
  reports: {
    // Gửi báo cáo
    create(body) {
      // body: { type, novelId?, chapterNo?, reason?, description?, attachments? }
      return request("/api/reports", {
        method: "POST",
        auth: true,
        body,
      });
    },

    // (tuỳ chọn) xem các báo cáo mình đã gửi
    my(params = {}) {
      // backend: GET /api/reports trả về history của user
      return request("/api/reports", {
        method: "GET",
        auth: true,
        params,
      });
    },
  },

  //Các chức năng của Admin
  admin: {
    listUsers() {
      return request("/api/admin/users", {
        method: "GET",
        auth: true,
      });
    },

    createUser(body) {
      return request("/api/admin/users", {
        method: "POST",
        auth: true,
        body,
      });
    },

    updateUser(id, body) {
      return request(`/api/admin/users/${id}`, {
        method: "PUT",
        auth: true,
        body,
      });
    },

    deleteUser(id) {
      return request(`/api/admin/users/${id}`, {
        method: "DELETE",
        auth: true,
      });
    },


    vipOrders: {
      list(params = {}) {
        return request("/api/admin/vip-orders", {
          method: "GET",
          auth: true,
          params,
        });
      },

      confirm(id, body = {}) {
        return request(`/api/admin/vip-orders/${id}/confirm`, {
          method: "POST",
          auth: true,
          body,
        });
      },

      cancel(id, body = {}) {
        return request(`/api/admin/vip-orders/${id}/cancel`, {
          method: "POST",
          auth: true,
          body,
        });
      },

      markPaid(id) {
        return request(`/api/admin/revenue/${id}/mark-paid`, {
          method: "POST",
          auth: true,
        });
      },
    },

    revenue: {
      list(params = {}) {
        return request("/api/admin/revenue", {
          method: "GET",
          auth: true,
          params,
        });
      },

      calculate(body) {
        return request("/api/admin/revenue/calculate", {
          method: "POST",
          auth: true,
          body,
        });
      },
      markPaid(id) {
        return request(`/api/admin/revenue/${id}/mark-paid`, {
          method: "POST",
          auth: true,
        });
      },
    },

    withdrawals: {
      list(params = {}) {
        return request("/api/admin/withdrawals", {
          method: "GET",
          auth: true,
          params,
        });
      },

      approve(id, body = {}) {
        return request(`/api/admin/withdrawals/${id}/approve`, {
          method: "PUT",
          auth: true,
          body,
        });
      },

      reject(id, body = {}) {
        return request(`/api/admin/withdrawals/${id}/reject`, {
          method: "PUT",
          auth: true,
          body,
        });
      },

      markPaid(id, body = {}) {
        return request(`/api/admin/withdrawals/${id}/paid`, {
          method: "PUT",
          auth: true,
          body,
        });
      },
    },

    // ==== THÊM MỚI: QUẢN LÝ TÁC PHẨM ====
    novels: {
      list(params = {}) {
        return request("/api/admin/novels", {
          method: "GET",
          auth: true,
          params,
        });
      },

      get(id) {
        return request(`/api/admin/novels/${id}`, {
          method: "GET",
          auth: true,
        });
      },

      create(body) {
        return request("/api/admin/novels", {
          method: "POST",
          auth: true,
          body,
        });
      },

      update(id, body) {
        return request(`/api/admin/novels/${id}`, {
          method: "PUT",
          auth: true,
          body,
        });
      },

      remove(id) {
        return request(`/api/admin/novels/${id}`, {
          method: "DELETE",
          auth: true,
        });
      },
    },

    // ==== THÊM MỚI: QUẢN LÝ CHƯƠNG ====
    chapters: {
      // GET /api/admin/chapters?novelId=&page=&pageSize=
      list(params = {}) {
        return request("/api/admin/chapters", {
          method: "GET",
          auth: true,
          params,
        });
      },

      // POST /api/admin/chapters  (body: { novelId, no?, title, content })
      create(novelId, body) {
        return request("/api/admin/chapters", {
          method: "POST",
          auth: true,
          body: { ...body, novelId },
        });
      },

      // PUT /api/admin/chapters/:id
      update(id, body) {
        return request(`/api/admin/chapters/${id}`, {
          method: "PUT",
          auth: true,
          body,
        });
      },

      // DELETE /api/admin/chapters/:id
      remove(id) {
        return request(`/api/admin/chapters/${id}`, {
          method: "DELETE",
          auth: true,
        });
      },
    },

    // ==== AUTHORS: list dùng để chọn khi thêm/sửa truyện ====
    authors: {
      list() {
        return request("/api/admin/authors", {
          method: "GET",
          auth: true,
        });
      },
    },

    // --- Quản lý thông báo (Admin gửi notification) ---
    notifications: {
      // GET /api/admin/notifications?userId=&page=&pageSize=
      list(params = {}) {
        return request("/api/admin/notifications", {
          method: "GET",
          auth: true,
          params,
        });
      },

      // POST /api/admin/notifications
      // body: { userId?, sendToAll?, title, content, type?, link? }
      create(body) {
        return request("/api/admin/notifications", {
          method: "POST",
          auth: true,
          body,
        });
      },

      // DELETE /api/admin/notifications/:id
      remove(id) {
        return request(`/api/admin/notifications/${id}`, {
          method: "DELETE",
          auth: true,
        });
      },
    },

    reports: {
      list(params = {}) {
        return request("/api/admin/reports", {
          method: "GET",
          auth: true,
          params,
        });
      },

      detail(id) {
        return request(`/api/admin/reports/${id}`, {
          method: "GET",
          auth: true,
        });
      },

      action(id, body) {
        // body: { decision: "warn"|"deleteContent"|"deleteUser"|"reject", adminNote? }
        return request(`/api/admin/reports/${id}/action`, {
          method: "POST",
          auth: true,
          body,
        });
      },
    },
  },

  // ===== Chat giữa người dùng =====
  chats: {
    // GET /api/chats/partners
    listPartners() {
      return request("/api/chats/partners", {
        auth: true,
      });
    },

    // GET /api/chats/:userId
    getConversation(userId) {
      return request(`/api/chats/${userId}`, {
        auth: true,
      });
    },

    // POST /api/chats/:userId
    sendMessage(userId, body) {
      return request(`/api/chats/${userId}`, {
        method: "POST",
        body,
        auth: true,
      });
    },

    // GET /api/chats/search?q=
    searchUsers(q) {
      return request("/api/chats/search", {
        auth: true,
        params: { q },
      });
    },

    // POST /api/chats/:userId/block
    blockUser(userId) {
      return request(`/api/chats/${userId}/block`, {
        method: "POST",
        auth: true,
      });
    },

    // DELETE /api/chats/:userId/block
    unblockUser(userId) {
      return request(`/api/chats/${userId}/block`, {
        method: "DELETE",
        auth: true,
      });
    },
  },

  adminWithdrawals: {
    list(params = {}) {
      return request("/api/admin/withdrawals", {
        method: "GET",
        auth: true,
        params,
      });
    },

    approve(id, body = {}) {
      return request(`/api/admin/withdrawals/${id}/approve`, {
        method: "PUT",
        auth: true,
        body,
      });
    },

    reject(id, body = {}) {
      return request(`/api/admin/withdrawals/${id}/reject`, {
        method: "PUT",
        auth: true,
        body,
      });
    },

    markPaid(id, body = {}) {
      return request(`/api/admin/withdrawals/${id}/paid`, {
        method: "PUT",
        auth: true,
        body,
      });
    },
  },

  // Thêm vào cuối object `api`, trước dấu đóng ngoặc `};`
  payos: {
    // Tạo link thanh toán, trả về { checkoutUrl, orderCode }
    createPaymentLink(plan) {
      return request("/api/payments/payos/create-payment-link", {
        method: "POST",
        auth: true,
        body: { plan },
      });
    },

    // Kiểm tra trạng thái đơn sau khi PayOS redirect về
    getOrderStatus(orderCode) {
      return request(`/api/payments/payos/order-status/${orderCode}`, {
        method: "GET",
        auth: true,
      });
    },
  },
};