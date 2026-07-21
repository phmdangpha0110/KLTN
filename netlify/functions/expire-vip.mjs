import mongoose from "mongoose";

import { connectDB } from "../../back-end/config/db.js";
import { expireAllExpiredVip } from "../../back-end/utils/vipStatus.js";

let connectionPromise;

async function ensureDatabase() {
  if (mongoose.connection.readyState === 1) return;

  if (!connectionPromise) {
    connectionPromise = connectDB().catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }

  await connectionPromise;
}

export default async () => {
  await ensureDatabase();
  const result = await expireAllExpiredVip();
  console.log("[VIP] Scheduled cleanup complete:", result);
};

export const config = {
  schedule: "@hourly",
};
