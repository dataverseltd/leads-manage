export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import Screenshot from "@/models/Screenshot";

const ok = (data: any, status = 200) => NextResponse.json(data, { status });
const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const isObjectId = (v: unknown): v is string =>
  typeof v === "string" && mongoose.Types.ObjectId.isValid(v);

/**
 * GET /api/employee/screenshots/search?leadId=...
 * Optional filters:
 *   - workingDay=YYYY-MM-DD
 *   - product=string (exact match on stored product name)
 *
 * Returns: [{ _id, url, productName, product }]
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return err("Unauthorized", 401);

    const url = new URL(req.url);
    const leadId = url.searchParams.get("leadId") || "";
    const workingDay = url.searchParams.get("workingDay") || "";
    const product = url.searchParams.get("product") || "";

    if (!isObjectId(leadId)) return err("Invalid leadId", 400);

    await connectDB();

    const q: any = { lead: new mongoose.Types.ObjectId(leadId) };

    // optional
    if (workingDay) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(workingDay)) {
        return err("Invalid workingDay (YYYY-MM-DD)", 400);
      }
      q.workingDay = workingDay;
    }
    if (product) {
      q.product = product.trim();
    }

    // optional company scoping if present in session
    const activeCompanyId = (session as any)?.activeCompanyId;
    if (isObjectId(activeCompanyId)) {
      q.companyId = new mongoose.Types.ObjectId(activeCompanyId as string);
    }

    const rows = await Screenshot.find(q, {
      url: 1,
      product: 1,
    })
      .sort({ uploadedAt: -1 })
      .lean();

    // shape for the modal
    const shaped = rows.map((r: any) => ({
      _id: String(r._id),
      url: r.url as string,
      productName: r.product as string,
      product: r.product as string,
    }));

    return ok(shaped);
  } catch (e: any) {
    return err(e?.message || "Server error", 500);
  }
}
