// apps/web/src/app/api/employee/screenshots/summary/route.ts
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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return err("Unauthorized", 401);

    const url = new URL(req.url);
    const workingDay = url.searchParams.get("workingDay") || "";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(workingDay)) {
      return err("workingDay (YYYY-MM-DD) required", 400);
    }

    await connectDB();

    const userId = (session as any)?.userId as string | undefined;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return err("Invalid user", 401);
    }

    const match: any = {
      uploadedBy: new mongoose.Types.ObjectId(userId),
      workingDay,
    };

    const activeCompanyId = (session as any)?.activeCompanyId as
      | string
      | undefined;
    if (activeCompanyId && mongoose.Types.ObjectId.isValid(activeCompanyId)) {
      match.companyId = new mongoose.Types.ObjectId(activeCompanyId);
    }

    // One pass for totals
    const [totals] = await Screenshot.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          distinctLeads: { $addToSet: "$lead" },
        },
      },
      {
        $project: {
          _id: 0,
          total: 1,
          distinctLeads: { $size: "$distinctLeads" },
        },
      },
    ]);

    // Detailed per-product breakdown
    const perProduct = await Screenshot.aggregate([
      { $match: match },
      {
        $addFields: {
          productKey: {
            $ifNull: ["$productName", { $ifNull: ["$product", "Unknown"] }],
          },
        },
      },
      {
        $group: {
          _id: "$productKey",
          count: { $sum: 1 },
          distinctLeads: { $addToSet: "$lead" },
          firstUploadAt: { $min: "$uploadedAt" },
          lastUploadAt: { $max: "$uploadedAt" },
          urls: { $push: "$url" }, // we'll slice recent below
        },
      },
      {
        $project: {
          _id: 0,
          product: "$_id",
          count: 1,
          distinctLeads: { $size: "$distinctLeads" },
          firstUploadAt: 1,
          lastUploadAt: 1,
          recentUrls: {
            $slice: [
              {
                $reverseArray: "$urls",
              },
              3,
            ],
          },
        },
      },
      { $sort: { count: -1, product: 1 } },
    ]);

    return ok({
      workingDay,
      total: totals?.total || 0,
      distinctLeads: totals?.distinctLeads || 0,
      items: perProduct, // [{ product, count, distinctLeads, firstUploadAt, lastUploadAt, recentUrls }]
    });
  } catch (e: any) {
    return err(e?.message || "Server error", 500);
  }
}
