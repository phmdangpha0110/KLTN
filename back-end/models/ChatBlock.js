import mongoose from "mongoose";

const { Schema } = mongoose;

const chatBlockSchema = new Schema(
  {
    blockerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blockedId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

chatBlockSchema.index(
  { blockerId: 1, blockedId: 1 },
  { unique: true, name: "uniq_chat_block_pair" }
);

export default mongoose.model("ChatBlock", chatBlockSchema);
