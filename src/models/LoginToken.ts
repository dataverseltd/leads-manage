import { Schema, model, models, Types } from "mongoose";

const LoginTokenSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    userAgent: { type: String },
    ip: { type: String },
    used: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Auto-purge when expired
LoginTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default models.LoginToken || model("LoginToken", LoginTokenSchema);
