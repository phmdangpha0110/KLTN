import mongoose from "mongoose";

const authorMonthlyRevenueSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    month: {
      type: String,
      required: true,
      index: true,
    },

    paidViews: {
      type: Number,
      default: 0,
    },

    totalPaidViews: {
      type: Number,
      default: 0,
    },

    grossRevenue: {
      type: Number,
      default: 0,
    },

    platformFeePercent: {
      type: Number,
      default: 50,
    },

    authorPool: {
      type: Number,
      default: 0,
    },

    sharePercent: {
      type: Number,
      default: 0,
    },

    amount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
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

authorMonthlyRevenueSchema.index(
  { authorId: 1, month: 1 },
  { unique: true }
);

export default mongoose.model(
  "AuthorMonthlyRevenue",
  authorMonthlyRevenueSchema
);