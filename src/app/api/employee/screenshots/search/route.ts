export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import mongoose, { Types, type FilterQuery } from "mongoose";
import Screenshot from "@/models/Screenshot";

/* ------------ Types ------------ */

type AppSession = Session & {
  activeCompanyId?: string;
};

type ScreenshotLean = {
  _id: Types.ObjectId;
  url: string;
  product: string;
  productName?: string; // some schemas keep both; we only read product
  lead: Types.ObjectId;
  workingDay?: string; // "YYYY-MM-DD"
  companyId?: Types.ObjectId;
  uploadedAt?: Date;
};

type Shaped = {
  _id: string;
  url: string;
  productName: string;
  product: string;
};

/* ---------- Helpers ---------- */

const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });
const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const isObjectIdString = (v: unknown): v is string =>
  typeof v === "string" && mongoose.Types.ObjectId.isValid(v);

/* ---------- Route ---------- */

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
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user) return err("Unauthorized", 401);

    const url = new URL(req.url);
    const leadId = url.searchParams.get("leadId") || "";
    const workingDay = url.searchParams.get("workingDay") || "";
    const product = url.searchParams.get("product") || "";

    if (!isObjectIdString(leadId)) return err("Invalid leadId", 400);

    await connectDB();

    const q: FilterQuery<ScreenshotLean> = {
      lead: new Types.ObjectId(leadId),
    };

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
    const activeCompanyId = session.activeCompanyId;
    if (isObjectIdString(activeCompanyId)) {
      q.companyId = new Types.ObjectId(activeCompanyId);
    }

    const rows = await Screenshot.find(q)
      .select({ url: 1, product: 1 })
      .sort({ uploadedAt: -1 })
      .lean<ScreenshotLean[]>();

    const shaped: Shaped[] = rows.map((r) => ({
      _id: String(r._id),
      url: r.url,
      productName: r.product, // expose product as productName for UI
      product: r.product,
    }));

    return ok(shaped);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
