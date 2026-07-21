import mongoose from "mongoose";

const withdrawalRequestSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1000,
    },

    bankName: {
      type: String,
      required: true,
      trim: true,
    },

    bankAccount: {
      type: String,
      required: true,
      trim: true,
    },

    bankHolder: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "paid"],
      default: "pending",
      index: true,
    },

    note: {
      type: String,
      default: "",
    },

    adminNote: {
      type: String,
      default: "",
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("WithdrawalRequest", withdrawalRequestSchema);