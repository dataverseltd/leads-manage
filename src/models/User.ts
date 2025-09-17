import { Schema, model, models, Types } from "mongoose";

const MembershipSchema = new Schema(
  {
    companyId: { type: Types.ObjectId, ref: "Company", required: true }, // ← removed index:true
    role: {
      type: String,
      enum: [
        "superadmin",
        "admin",
        "lead_operator",
        "fb_submitter",
        "fb_analytics_viewer",
      ],
      required: true,
    },
    canUploadLeads: { type: Boolean, default: false },
    canReceiveLeads: { type: Boolean, default: false },
    can_distribute_leads: { type: Boolean, default: false },
    can_distribute_fbids: { type: Boolean, default: false },
    can_create_user: { type: Boolean, default: false },
    lastReceivedAt: { type: Date, default: null },
    distributionWeight: { type: Number, default: 1 },
    maxConcurrentLeads: { type: Number, default: 0 },
    dailyCap: { type: Number, default: 0 }, // 0 = unlimited per day
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, unique: true, sparse: true, trim: true }, // keep unique here
    passwordHash: String,
    employeeId: { type: String, unique: true, sparse: true, trim: true }, // keep unique here
    isActive: { type: Boolean, default: true },
    memberships: { type: [MembershipSchema], default: [] },

    currentSessionToken: { type: String, default: null },
    isLoggedIn: { type: Boolean, default: false },
    lastLoginAt: Date,
    lastLogoutAt: Date,
    lastKnownIP: String,
    lastUserAgent: String,
    loginHistory: [
      {
        ip: String,
        userAgent: String,
        loggedInAt: Date,
        loggedOutAt: Date,
      },
    ],
  },
  { timestamps: true, collection: "users" }
);

// ✅ declare ONLY the index we didn't set at field-level
UserSchema.index({ "memberships.companyId": 1 });

export default models.User || model("User", UserSchema);
