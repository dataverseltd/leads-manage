import { Schema, model, models, Types } from "mongoose";

export interface CompanyMonthlyProductType {
  companyId: Types.ObjectId;
  month: string; // "YYYY-MM"
  name: string; // display name
  slug?: string;
  order?: number;
  active?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const CompanyMonthlyProductSchema = new Schema<CompanyMonthlyProductType>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    month: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "company_monthly_products" }
);

// Ensure uniqueness within company+month by name
CompanyMonthlyProductSchema.index(
  { companyId: 1, month: 1, name: 1 },
  { unique: true }
);

const CompanyMonthlyProduct =
  models.CompanyMonthlyProduct ||
  model<CompanyMonthlyProductType>(
    "CompanyMonthlyProduct",
    CompanyMonthlyProductSchema
  );

export default CompanyMonthlyProduct;
