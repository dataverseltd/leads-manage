import mongoose, { Schema, Types } from "mongoose";

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
  sourceCompanyId?: Types.ObjectId | null;
  targetCompanyId?: Types.ObjectId | null;
  assignedCompanyId?: Types.ObjectId | null;

  createdAt?: string | Date;
}

const LeadSchema = new Schema<LeadType>(
  {
    fb_id_name: { type: String, trim: true },
    client_name: { type: String, trim: true },
    number: { type: String, unique: true, required: true, trim: true },
    rent: { type: String, trim: true },
    house_apt: { type: String, trim: true },
    house_apt_details: { type: String, trim: true },
    address: { type: String, trim: true },
    post_link: { type: String, trim: true },

    screenshot_link: { type: String, trim: true, default: "" },
    signup_screenshot_link: { type: String, trim: true, default: "" },

    lead_status: {
      type: String,
      enum: ["pending", "assigned", "in_progress", "approved", "rejected"],
      default: "pending",
      index: true,
    },

    submitted_by: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assigned_to: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    assigned_at: { type: Date, default: null },

    workingDay: { type: String, required: true, index: true },

    // NEW company fields
    sourceCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    targetCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    assignedCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
  },
  { timestamps: true, collection: "leads" }
);

// Helpful compounds for dashboards:
LeadSchema.index({ workingDay: 1, assignedCompanyId: 1 });
LeadSchema.index({ assignedCompanyId: 1, lead_status: 1, workingDay: 1 });
LeadSchema.index({ createdAt: -1 });
// Fast filter + sort combo
LeadSchema.index({ assigned_to: 1, workingDay: -1, createdAt: -1 });
// Speeds up “latest day first” scans
LeadSchema.index({ workingDay: -1, createdAt: -1, assigned_to: 1 });
// Optional: lightweight text/regex helpers (avoid full text index unless you need it)
LeadSchema.index({ number: 1 });
LeadSchema.index({ address: 1 });
LeadSchema.index({ fb_id_name: 1 });
LeadSchema.index({ client_name: 1 });
// (Keep your existing indexes)
export default mongoose.models.Lead || mongoose.model("Lead", LeadSchema);
