// src/models/DistributionSwitch.ts
import mongoose, { Schema, Types } from "mongoose";

export interface DistributionSwitchType {
  workingDay: string; // e.g. "2025-09-12"
  isActive: boolean; // ON/OFF for today's auto-distribution
  activatedBy?: Types.ObjectId | null; // ref User (admin/superadmin)
  activatedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  companyId?: Types.ObjectId | null; // ref Company (optional)
}

const DistributionSwitchSchema = new Schema<DistributionSwitchType>(
  {
    workingDay: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: false },
    activatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    activatedAt: { type: Date, default: null },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: false,
      index: true,
    },
  },
  { timestamps: true, collection: "distribution_switches" }
);

// One doc per workingDay
DistributionSwitchSchema.index({ workingDay: 1 }, { unique: true });
DistributionSwitchSchema.index(
  { companyId: 1, workingDay: 1 },
  { unique: true, partialFilterExpression: { companyId: { $exists: true } } }
);
DistributionSwitchSchema.index(
  { workingDay: 1 },
  { unique: true, partialFilterExpression: { companyId: { $exists: false } } }
);
export default mongoose.models.DistributionSwitch ||
  mongoose.model<DistributionSwitchType>(
    "DistributionSwitch",
    DistributionSwitchSchema
  );
