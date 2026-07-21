// back-end/routes/admin.novels.js
import { Router } from "express";
import Novel from "../models/Novel.js";
import Chapter from "../models/Chapter.js";
import { requireAdmin } from "../utils/requireAdmin.js";

const r = Router();

r.use(requireAdmin);

// GET /api/admin/novels
r.get("/", async (req, res) => {
  try {
    const novels = await Novel.find().sort({ createdAt: -1 });
    res.json({ items: novels, total: novels.length });
  } catch (err) {
    console.error("GET /api/admin/novels error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/admin/novels/:id
r.get("/:id", async (req, res) => {
  try {
    const novel = await Novel.findById(req.params.id);
    if (!novel) return res.status(404).json({ message: "Not found" });

    const chapters = await Chapter.find({ novelId: novel._id }).sort({ no: 1 });
    res.json({ novel, chapters });
  } catch (err) {
    console.error("GET /api/admin/novels/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/admin/novels
r.post("/", async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.isDelete;

    const novel = await Novel.create(data);
    res.status(201).json({ novel });
  } catch (err) {
    console.error("POST /api/admin/novels error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/admin/novels/:id
r.put("/:id", async (req, res) => {
  try {
    const data = { ...req.body };
    // Admin không được khôi phục/chỉnh trực tiếp cờ soft delete.
    delete data.isDelete;

    const novel = await Novel.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true }
    );
    if (!novel) return res.status(404).json({ message: "Not found" });
    res.json({ novel });
  } catch (err) {
    console.error("PUT /api/admin/novels/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/admin/novels/:id
// Soft delete truyện và toàn bộ chapter; admin không có API khôi phục.
r.delete("/:id", async (req, res) => {
  try {
    const novel = await Novel.findById(req.params.id);
    if (!novel) return res.status(404).json({ message: "Not found" });

    await Promise.all([
      Novel.updateOne({ _id: novel._id }, { $set: { isDelete: true } }),
      Chapter.updateMany(
        { novelId: novel._id },
        { $set: { isDelete: true } }
      ),
    ]);

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE /api/admin/novels/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default r;
