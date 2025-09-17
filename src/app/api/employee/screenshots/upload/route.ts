export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import Screenshot from "@/models/Screenshot";
import CompanyMonthlyProduct from "@/models/CompanyMonthlyProduct";
import Lead from "@/models/Lead";
type CompanyMonthlyProductLean = {
  _id: mongoose.Types.ObjectId;
  name: string;
  month: string; // "YYYY-MM"
  companyId: mongoose.Types.ObjectId;
  active: boolean;
};
const ok = (data: any, status = 200) => NextResponse.json(data, { status });
const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const isObjectId = (v: unknown): v is string =>
  typeof v === "string" && mongoose.Types.ObjectId.isValid(v);

const monthFromDay = (workingDay: string) => workingDay.slice(0, 7); // "YYYY-MM-DD" -> "YYYY-MM"

/**
 * POST /api/employee/screenshots/upload
 * body: { leadId: string, url: string, productId: string, workingDay: "YYYY-MM-DD" }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return err("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const { leadId, url, productId, workingDay } = body || {};

    if (!isObjectId(leadId)) return err("Invalid leadId", 400);
    if (!isObjectId(productId)) return err("Invalid productId", 400);
    if (typeof url !== "string" || !url.trim()) return err("Invalid url", 400);
    if (
      typeof workingDay !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(workingDay)
    ) {
      return err("Invalid workingDay", 400);
    }

    await connectDB();

    const lead = await Lead.findById(leadId).lean();
    if (!lead) return err("Lead not found", 404);

    const assignedCompanyId = (lead as any).assignedCompanyId;
    if (!assignedCompanyId || !isObjectId(String(assignedCompanyId))) {
      return err("Lead has no assignedCompanyId", 400);
    }
    const companyId = new mongoose.Types.ObjectId(String(assignedCompanyId));

    const productDoc = await CompanyMonthlyProduct.findById(productId).lean<{
      _id: mongoose.Types.ObjectId;
      name: string;
      month: string; // "YYYY-MM"
      companyId: mongoose.Types.ObjectId;
      active: boolean;
    }>();
    if (!productDoc) return err("Product not found", 404);
    if (productDoc.active === false) return err("Product is inactive", 400);

    const dayMonth = workingDay.slice(0, 7); // "YYYY-MM"
    if (productDoc.month !== dayMonth) {
      return err(
        `Product belongs to ${productDoc.month}, but workingDay is ${dayMonth}`,
        400
      );
    }
    if (String(productDoc.companyId) !== String(companyId)) {
      return err("Product and lead belong to different companies", 403);
    }

    const sessionUserId = (session as any).userId;
    const uploadedBy =
      typeof sessionUserId === "string" &&
      mongoose.Types.ObjectId.isValid(sessionUserId)
        ? new mongoose.Types.ObjectId(sessionUserId)
        : null;

    // ✅ NEW: include required fields productId/productName/productMonth
    const created = await Screenshot.create({
      lead: new mongoose.Types.ObjectId(leadId),
      url: url.trim(),
      uploadedBy,
      uploadedAt: new Date(),
      workingDay,
      reviewed: false,
      companyId,

      // required by your schema now:
      productId: new mongoose.Types.ObjectId(productDoc._id),
      productName: String(productDoc.name).trim(),
      productMonth: productDoc.month,

      // keep legacy for older UI (safe to keep both):
      product: String(productDoc.name).trim(),
    });

    return ok(
      {
        _id: String(created._id),
        productName: productDoc.name,
        productMonth: productDoc.month,
      },
      201
    );
  } catch (e: any) {
    return err(e?.message || "Server error", 500);
  }
}
