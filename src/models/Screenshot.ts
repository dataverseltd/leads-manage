// src/lib/models/Screenshot.ts
import mongoose, { Schema } from "mongoose";

const ScreenshotSchema = new Schema(
  {
    lead: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },

    // ✅ new: stable reference
    productId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyMonthlyProduct",
      required: true,
      index: true,
    },

    // optional but VERY useful denormalization
    productName: { type: String, required: true, trim: true }, // snapshot of product name
    productMonth: { type: String, required: true, index: true }, // "YYYY-MM" derived from workingDay

    // keep url, user, day, etc.
    url: { type: String, required: true, trim: true },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    uploadedAt: { type: Date, default: Date.now },
    workingDay: { type: String, required: true, index: true }, // "YYYY-MM-DD"

    reviewed: { type: Boolean, default: false, index: true },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", index: true },
  },
  { timestamps: true, collection: "screenshots" }
);

// Helpful compound indexes
ScreenshotSchema.index({ workingDay: 1, uploadedBy: 1, productId: 1 });
ScreenshotSchema.index({ productMonth: 1, productId: 1 });

export default mongoose.models.Screenshot ||
  mongoose.model("Screenshot", ScreenshotSchema);
