// back-end/routes/auth.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { verifyGoogleIdToken } from "../utils/googleAuth.js"; //GoogleLogin
import { expireVipIfNeeded } from "../utils/vipStatus.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = (req.body || {});
    if (!email || !password)
      return res.status(400).json({ message: "Thiếu email hoặc mật khẩu." });

    const u = await User.findOne({ email });
    if (!u) return res.status(400).json({ message: "Email chưa đăng ký." });

    if (u.status === "suspended")
      return res.status(403).json({ message: "Tài khoản đã bị tạm khóa." });

    if (!u.password)
      return res.status(500).json({ message: "Tài khoản chưa có mật khẩu. Hãy chạy seed mới." });

    const ok = await bcrypt.compare(password, u.password || "");
    if (!ok) return res.status(400).json({ message: "Sai mật khẩu." });

    const token = jwt.sign({ id: u._id }, JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      token,
      user: {
        id: u._id,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        role: u.role,
        bio: u.bio || "",
      },
    });
  } catch (err) {
    console.error("POST /auth/login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing token" });
  }
  try {
    const token = header.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET);
    const u = await User.findById(payload.id).lean();
    if (!u) return res.status(404).json({ message: "User not found" });
    const followersCount = await User.countDocuments({
      followAuthors: u._id,
    });
    return res.json({
      id: u._id,
      _id: u._id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      role: u.role,
      bio: u.bio || "",
      followersCount,
      isVip: Boolean(u.isVip),
      vipUntil: u.vipUntil || null,
    });
  } catch {
    return res.status(401).json({ message: "Token không hợp lệ" });
  }
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
    try {
      const { name, email, password } = req.body || {};
      if (!name || !email || !password)
        return res.status(400).json({ message: "Thiếu tên, email hoặc mật khẩu." });
  
      const existed = await User.findOne({ email }).withDeleted();
      if (existed) return res.status(400).json({ message: "Email đã được sử dụng." });
  
      const hash = await bcrypt.hash(password, 10);
      const u = await User.create({
        name, email, password: hash, role: "user", status: "active",
      });
  
      const token = jwt.sign({ id: u._id }, JWT_SECRET, { expiresIn: "7d" });
      res.json({
        token,
        user: { id: u._id, name: u.name, email: u.email, avatar: u.avatar, role: u.role, bio: u.bio || "" },
            });
    } catch (err) {
      console.error("POST /auth/register error:", err);
      res.status(500).json({ message: "Server error" });
    }
});
  
// Đăng nhập bằng Google
// POST /api/auth/google
router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "Thiếu idToken từ Google" });
    }

    // 1. Xác thực token với Google
    const payload = await verifyGoogleIdToken(idToken);

    const googleId = payload.sub;            // ID duy nhất của user trên Google
    const email = payload.email;
    const name = payload.name || "Google User";
    const avatar = payload.picture;

    if (!email) {
      return res.status(400).json({
        message: "Không lấy được email từ tài khoản Google. Vui lòng kiểm tra scope.",
      });
    }

    // 2. Tìm user theo email (ưu tiên), nếu không có thì tạo mới
    let user = await User.findOne({ email }).withDeleted();

    if (user?.isDelete) {
      return res.status(403).json({ message: "Tài khoản đã bị xóa." });
    }

    await expireVipIfNeeded(user);

    if (!user) {
      const randomHash = await bcrypt.hash(`google:${googleId}:${Date.now()}`, 10);

      user = new User({
        email,
        name,
        avatar,
        googleId,
        provider: "google",
        password: randomHash,
        role: "user",
        status: "active",
      });

      await user.save();
    } else {
      if (!user.googleId) user.googleId = googleId;
      if (!user.provider) user.provider = "google";
      await user.save();
    }

    // 3. Tạo JWT giống với login thường
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 4. Trả về token + user cho front-end
    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role, // nếu schema có
        bio: user.bio || "",
      },
    });
  } catch (err) {
    console.error("Google Login error:", err);
    return res.status(500).json({ message: "Lỗi đăng nhập Google" });
  }
});

export default router;
