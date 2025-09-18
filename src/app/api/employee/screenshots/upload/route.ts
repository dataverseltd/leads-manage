export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import mongoose, { Types } from "mongoose";
import Screenshot from "@/models/Screenshot";
import CompanyMonthlyProduct from "@/models/CompanyMonthlyProduct";
import Lead from "@/models/Lead";

type AppSession = Session & { userId?: string };

type LeadLean = {
  _id: Types.ObjectId;
  assignedCompanyId?: Types.ObjectId | string | null;
};

type ProductLean = {
  _id: Types.ObjectId;
  name: string;
  month: string; // "YYYY-MM"
  companyId: Types.ObjectId;
  active?: boolean;
};

type PostBody = {
  leadId?: string;
  url?: string;
  productId?: string;
  workingDay?: string;
};

const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });
const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const isObjectIdString = (v: unknown): v is string =>
  typeof v === "string" && mongoose.Types.ObjectId.isValid(v);

/**
 * POST /api/employee/screenshots/upload
 * body: { leadId: string, url: string, productId: string, workingDay: "YYYY-MM-DD" }
 */
export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user) return err("Unauthorized", 401);

    let body: PostBody;
    try {
      body = (await req.json()) as PostBody;
    } catch {
      body = {};
    }
    const { leadId, url, productId, workingDay } = body;

    if (!isObjectIdString(leadId)) return err("Invalid leadId", 400);
    if (!isObjectIdString(productId)) return err("Invalid productId", 400);
    if (typeof url !== "string" || !url.trim()) return err("Invalid url", 400);
    if (
      typeof workingDay !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(workingDay)
    ) {
      return err("Invalid workingDay", 400);
    }

    await connectDB();

    const lead = await Lead.findById(leadId).lean<LeadLean | null>();
    if (!lead) return err("Lead not found", 404);

    const assignedCompanyId = lead.assignedCompanyId;
    if (!assignedCompanyId || !isObjectIdString(String(assignedCompanyId))) {
      return err("Lead has no assignedCompanyId", 400);
    }
    const companyId = new mongoose.Types.ObjectId(String(assignedCompanyId));

    const productDoc = await CompanyMonthlyProduct.findById(
      productId
    ).lean<ProductLean | null>();
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

    const sessionUserId = session.userId;
    const uploadedBy =
      typeof sessionUserId === "string" &&
      mongoose.Types.ObjectId.isValid(sessionUserId)
        ? new mongoose.Types.ObjectId(sessionUserId)
        : null;

    // Create screenshot
    const created = await Screenshot.create({
      lead: new mongoose.Types.ObjectId(leadId),
      url: url.trim(),
      uploadedBy,
      uploadedAt: new Date(),
      workingDay,
      reviewed: false,
      companyId,

      // required schema fields:
      productId: new mongoose.Types.ObjectId(productDoc._id),
      productName: String(productDoc.name).trim(),
      productMonth: productDoc.month,

      // legacy compatibility:
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
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
