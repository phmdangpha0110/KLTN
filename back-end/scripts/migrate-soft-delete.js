import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import Novel from "../models/Novel.js";
import Chapter from "../models/Chapter.js";
import User from "../models/User.js";
import Comment from "../models/Comment.js";

async function main() {
  await connectDB();

  const models = [Novel, Chapter, User, Comment];
  for (const Model of models) {
    const result = await Model.collection.updateMany(
      { isDelete: { $exists: false } },
      { $set: { isDelete: false } }
    );
    console.log(`[SOFT DELETE] ${Model.modelName}: initialized ${result.modifiedCount} documents`);
  }

  const indexes = await Chapter.collection.indexes();
  for (const index of indexes) {
    const sameChapterKey =
      index.key?.novelId === 1 &&
      index.key?.no === 1 &&
      Object.keys(index.key).length === 2;

    if (sameChapterKey && index.name !== "novelId_1_no_1_active") {
      console.log(`[SOFT DELETE] Dropping old chapter index: ${index.name}`);
      await Chapter.collection.dropIndex(index.name);
    }
  }

  await Chapter.collection.createIndex(
    { novelId: 1, no: 1 },
    {
      unique: true,
      name: "novelId_1_no_1_active",
      partialFilterExpression: { isDelete: false },
    }
  );

  console.log("[SOFT DELETE] Migration completed.");
}

main()
  .catch((err) => {
    console.error("[SOFT DELETE] Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
