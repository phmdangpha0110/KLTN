import serverless from "serverless-http";
import mongoose from "mongoose";

import app from "../../back-end/app.js";
import { connectDB } from "../../back-end/config/db.js";

let connectionPromise;
const expressHandler = serverless(app);

function validateRuntimeConfig() {
  const required = ["MONGODB_URI", "JWT_SECRET"];
  const missing = required.filter(
    (key) => !String(process.env[key] || "").trim()
  );

  if (missing.length) {
    throw new Error(
      `Thiếu biến môi trường Netlify bắt buộc: ${missing.join(", ")}`
    );
  }
}

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

export const handler = async (event, context) => {
  validateRuntimeConfig();
  await ensureDatabase();
  return expressHandler(event, context);
};
