import mongoose, { Schema, Types, model, models } from "mongoose";

// If you want TS to mirror what Mongo actually stores, prefer Date for createdAt.
// (Mongoose timestamps always store Date.)
export interface LeadType {
  fb_id_name: string;
  client_name: string;
  number: string;
  rent: string;
  house_apt: string;
  house_apt_details: string;
  address: string;
  post_link: string;
  screenshot_link?: string;
  signup_screenshot_link?: string;
  lead_status: "pending" | "assigned" | "in_progress" | "approved" | "rejected";
  submitted_by: Types.ObjectId; // ref User
  assigned_to?: Types.ObjectId | null; // ref User
  assigned_at?: Date | null;
  workingDay: string;

  // NEW (optional initially)
  sourceCompanyId?: Types.ObjectId | null; // ref Company
  targetCompanyId?: Types.ObjectId | null; // ref Company
  assignedCompanyId?: Types.ObjectId | null; // ref Company

  createdAt?: Date; // from timestamps
  updatedAt?: Date; // from timestamps
}
const LeadSchema = new Schema<LeadType>(
  {
    fb_id_name: { type: String, trim: true },
    client_name: { type: String, trim: true },

    // ❌ Remove inline unique:true
    number: { type: String, required: true, trim: true },

    rent: { type: String, trim: true },
    house_apt: { type: String, trim: true },
    house_apt_details: { type: String, trim: true },
    address: { type: String, trim: true },
    post_link: { type: String, trim: true },

    screenshot_link: { type: String, trim: true, default: "" },
    signup_screenshot_link: { type: String, trim: true, default: "" },

    lead_status: {
      type: String,
      enum: ["pending", "assigned", "in_progress", "done", "rejected"],
      default: "pending",
    },

    submitted_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assigned_to: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assigned_at: { type: Date, default: null },
    workingDay: { type: String, required: true },
    sourceCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    targetCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    assignedCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
  },
  { timestamps: true, collection: "leads" }
);

/* ---- Indexes ---- */
LeadSchema.index({ workingDay: 1 });
LeadSchema.index({ createdAt: -1 });
LeadSchema.index({ workingDay: 1, assignedCompanyId: 1 });
LeadSchema.index({ assignedCompanyId: 1, lead_status: 1, workingDay: 1 });
LeadSchema.index({ workingDay: 1, lead_status: 1, targetCompanyId: 1 });
LeadSchema.index({ assigned_to: 1, lead_status: 1, targetCompanyId: 1 });
LeadSchema.index({ targetCompanyId: 1, lead_status: 1 });

// ✅ Main protection — same number cannot appear twice on same workingDay
LeadSchema.index({ number: 1, workingDay: 1 }, { unique: true });

export default mongoose.models.Lead || mongoose.model("Lead", LeadSchema);
