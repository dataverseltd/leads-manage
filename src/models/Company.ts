// src/models/Company.ts
import { Schema, model, models } from "mongoose";

const CompanySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    active: { type: Boolean, default: true },

    // NEW: company policy — what this company fundamentally does
    roleMode: {
      type: String,
      enum: ["uploader", "receiver", "hybrid"],
      default: "hybrid",
      // uploader  = company staff primarily upload leads (cannot receive)
      // receiver  = company staff primarily receive leads (cannot upload)
      // hybrid    = both allowed (current behavior)
    },

    // Optional, in case you want to toggle features regardless of mode
    allows: {
      type: new Schema(
        {
          uploadLeads: { type: Boolean, default: true }, // uploader/hybrid → true by default
          receiveLeads: { type: Boolean, default: true }, // receiver/hybrid → true by default
          uploadFBIds: { type: Boolean, default: true },
        },
        { _id: false }
      ),
      default: undefined,
    },

    products: { type: [String], default: [] },
    features: { type: Map, of: Boolean, default: {} },
  },
  { timestamps: true, collection: "companies" }
);

export default models.Company || model("Company", CompanySchema);
