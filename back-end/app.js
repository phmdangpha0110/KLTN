import express from "express";
import cors from "cors";
import morgan from "morgan";

import api from "./routes/index.js";
import sandboxPay from "./routes/payments.sandbox.js";
import followAuthorsRoutes from "./routes/followAuthors.js";
import adminNotificationsRouter from "./routes/admin.notifications.js";
import notificationsRouter from "./routes/notifications.js";
import reportsRouter from "./routes/reports.js";
import adminReportsRouter from "./routes/admin.reports.js";
import payosRouter from "./routes/payments.payos.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/", (_, res) => res.json({ ok: true, name: "DKStory API" }));
app.use("/api", api);
app.use("/api/authors", followAuthorsRoutes);
app.use("/api/admin/notifications", adminNotificationsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/admin/reports", adminReportsRouter);

// API VIP thật: vòng quay, đổi mã, mua VIP
app.use("/api/vip", sandboxPay);

// Giữ route cũ để không lỗi các chức năng đang dùng link sandbox
if (process.env.PAYMENTS_SANDBOX === "true") {
  app.use("/api/payments/sandbox", sandboxPay);
}

app.use("/api/payments/payos", payosRouter);

export default app;
