// apps/web/src/app/api/employee/screenshots/summary/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import mongoose, { Types } from "mongoose";
import Screenshot from "@/models/Screenshot";

type AppSession = Session & {
  userId?: string;
  activeCompanyId?: string;
};

type TotalsRow = {
  total: number;
  distinctLeads: number;
};

type PerProductRow = {
  product: string;
  count: number;
  distinctLeads: number;
  firstUploadAt: Date | null;
  lastUploadAt: Date | null;
  recentUrls: string[];
};

const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });
const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user) return err("Unauthorized", 401);

    const url = new URL(req.url);
    const workingDay = url.searchParams.get("workingDay") || "";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(workingDay)) {
      return err("workingDay (YYYY-MM-DD) required", 400);
    }

    await connectDB();

    const userId = session.userId;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return err("Invalid user", 401);
    }

    // Build match object (typed, no `any`)
    const match: {
      uploadedBy: Types.ObjectId;
      workingDay: string;
      companyId?: Types.ObjectId;
    } = {
      uploadedBy: new mongoose.Types.ObjectId(userId),
      workingDay,
    };

    const activeCompanyId = session.activeCompanyId;
    if (activeCompanyId && mongoose.Types.ObjectId.isValid(activeCompanyId)) {
      match.companyId = new mongoose.Types.ObjectId(activeCompanyId);
    }

    // One pass for totals
    const totalsArr = (await Screenshot.aggregate([
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
    ])) as TotalsRow[];

    const totals: TotalsRow | undefined = totalsArr[0];

    // Detailed per-product breakdown
    const perProduct = (await Screenshot.aggregate([
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
          urls: { $push: "$url" },
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
            $slice: [{ $reverseArray: "$urls" }, 3],
          },
        },
      },
      { $sort: { count: -1, product: 1 } },
    ])) as PerProductRow[];

    return ok({
      workingDay,
      total: totals?.total ?? 0,
      distinctLeads: totals?.distinctLeads ?? 0,
      items: perProduct, // [{ product, count, distinctLeads, firstUploadAt, lastUploadAt, recentUrls }]
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
