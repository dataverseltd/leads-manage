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

    // `unique: true` already creates an index. Do NOT add a separate schema.index({ number: 1 })
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

    // company fields
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
  {
    timestamps: true,
    collection: "leads",
    // Avoid background index builds in prod hot paths; create via migrations instead.
    autoIndex: process.env.NODE_ENV !== "production",
  }
);

/* ---------- Indexes (no duplicates) ---------- */

// Helpful compounds for dashboards:
LeadSchema.index({ workingDay: 1, assignedCompanyId: 1 });
LeadSchema.index({ assignedCompanyId: 1, lead_status: 1, workingDay: 1 });

// Fast filter + sort combos:
LeadSchema.index({ assigned_to: 1, workingDay: -1, createdAt: -1 });
LeadSchema.index({ workingDay: -1, createdAt: -1, assigned_to: 1 });

// CreatedAt is useful for “latest first”
LeadSchema.index({ createdAt: -1 });

// Optional simple field helpers (these are fine; just don't duplicate `number`):
LeadSchema.index({ address: 1 });
LeadSchema.index({ fb_id_name: 1 });
LeadSchema.index({ client_name: 1 });

// ❌ DO NOT add: LeadSchema.index({ number: 1 })  ← would duplicate the unique index

// Next.js-safe model export (prevents recompile warnings)
const Lead = models.Lead || model<LeadType>("Lead", LeadSchema);
export default Lead;
