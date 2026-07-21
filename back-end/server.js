import "dotenv/config";

import app from "./app.js";
import { connectDB } from "./config/db.js";
import { expireAllExpiredVip } from "./utils/vipStatus.js";

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    await expireAllExpiredVip().catch((err) =>
      console.error("[VIP] expire on startup failed:", err)
    );

    setInterval(() => {
      expireAllExpiredVip().catch((err) =>
        console.error("[VIP] periodic expire failed:", err)
      );
    }, 60 * 60 * 1000);

    app.listen(PORT, () => console.log(`API ready at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("DB connect failed:", err);
    process.exit(1);
  });
