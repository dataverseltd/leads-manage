// D:\DataVerse\lead-suite\apps\web\src\app\api\dashboard\signup-summary\route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import User from "@/models/User";
import Company from "@/models/Company";
import Screenshot from "@/models/Screenshot";

/* ===================== Types ===================== */
type Role =
  | "superadmin"
  | "admin"
  | "employee"
  | "fb_submitter"
  | "fb_analytics_viewer"
  | "";

type Membership = {
  companyId: mongoose.Types.ObjectId | string;
  role?: Role | string;
};

type UserLean = {
  memberships?: Membership[];
};

type CompanyLean = {
  _id: mongoose.Types.ObjectId;
  name: string;
};

type ByCompanyRow = {
  companyId: mongoose.Types.ObjectId;
  total: number;
  reviewed: number;
  unreviewed: number;
};

type ByCompanyProductRow = {
  companyId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId | string | null;
  productName: string;
  total: number;
  reviewed: number;
  unreviewed: number;
};

type AppSession = Session & {
  userId?: string | null;
  user?: Session["user"] & { id?: string | null };
};

type PerCompanyOut = {
  companyId: string;
  companyName: string;
  totals: { total: number; reviewed: number; unreviewed: number };
  byProduct: Array<{
    productId: string;
    productName: string;
    total: number;
    reviewed: number;
    unreviewed: number;
  }>;
};

const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });
const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

/* ===================== Helpers ===================== */
function ensureIso(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}
const toObjId = (id: string) => new mongoose.Types.ObjectId(id);
const toStrId = (id: string | mongoose.Types.ObjectId) =>
  typeof id === "string" ? id : id.toString();

function getSessionUserId(session: AppSession | null): string {
  if (!session) return "";
  return (session.userId ?? session.user?.id ?? "")?.toString();
}

/* ===================== Route ===================== */
export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user) return err("Unauthorized", 401);

    const url = new URL(req.url);
    const workingDay = url.searchParams.get("workingDay") || "";

    if (!ensureIso(workingDay)) {
      return err("Invalid workingDay (YYYY-MM-DD required)", 400);
    }

    await connectDB();

    // 1) Load current user memberships (companyIds)
    const userId = getSessionUserId(session);
    const user = await User.findById(userId, { memberships: 1 })
      .lean<UserLean>()
      .exec();

    const membershipCompanyIds: string[] = (user?.memberships ?? [])
      .map((m) => toStrId(m.companyId))
      .filter(Boolean);

    if (membershipCompanyIds.length === 0) {
      return ok({
        workingDay,
        companies: [] as PerCompanyOut[],
        totals: { total: 0, reviewed: 0, unreviewed: 0 },
      });
    }

    // 2) Keep only receiver/hybrid companies (+ receive allowed)
    const companies = await Company.find(
      {
        _id: { $in: membershipCompanyIds.map(toObjId) },
        roleMode: { $in: ["receiver", "hybrid"] },
        active: { $ne: false },
        $or: [
          { "allows.receiveLeads": { $exists: false } },
          { "allows.receiveLeads": true },
        ],
      },
      { _id: 1, name: 1 }
    )
      .lean<CompanyLean[]>()
      .exec();

    const allowedCompanyIds = companies.map((c) => toStrId(c._id));
    if (allowedCompanyIds.length === 0) {
      return ok({
        workingDay,
        companies: [] as PerCompanyOut[],
        totals: { total: 0, reviewed: 0, unreviewed: 0 },
      });
    }

    // 3) Aggregate screenshots for these companies on this workingDay
    const matchStage: {
      companyId: { $in: mongoose.Types.ObjectId[] };
      workingDay: string;
    } = {
      companyId: { $in: allowedCompanyIds.map(toObjId) },
      workingDay,
    };

    // Totals by company (quick overview)
    const byCompany = await Screenshot.aggregate<ByCompanyRow>([
      { $match: matchStage },
      {
        $group: {
          _id: "$companyId",
          total: { $sum: 1 },
          reviewed: { $sum: { $cond: [{ $eq: ["$reviewed", true] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          companyId: "$_id",
          total: 1,
          reviewed: 1,
          unreviewed: { $subtract: ["$total", "$reviewed"] },
        },
      },
    ]);

    // By product within each company
    const byCompanyProduct = await Screenshot.aggregate<ByCompanyProductRow>([
      { $match: matchStage },
      {
        $group: {
          _id: {
            companyId: "$companyId",
            productId: "$productId",
            productName: "$productName",
          },
          total: { $sum: 1 },
          reviewed: { $sum: { $cond: [{ $eq: ["$reviewed", true] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          companyId: "$_id.companyId",
          productId: "$_id.productId",
          productName: "$_id.productName",
          total: 1,
          reviewed: 1,
          unreviewed: { $subtract: ["$total", "$reviewed"] },
        },
      },
      { $sort: { productName: 1 } },
    ]);

    // 4) Shape response grouped per company
    const companyNameMap = new Map<string, string>(
      companies.map((c) => [toStrId(c._id), c.name])
    );

    const byCompanyMap = new Map<string, ByCompanyRow>(
      byCompany.map((c) => [toStrId(c.companyId), c])
    );

    const byCompanyProdMap = new Map<string, ByCompanyProductRow[]>();
    for (const row of byCompanyProduct) {
      const key = toStrId(row.companyId);
      const arr = byCompanyProdMap.get(key);
      if (arr) arr.push(row);
      else byCompanyProdMap.set(key, [row]);
    }

    const perCompany: PerCompanyOut[] = [];
    for (const cid of allowedCompanyIds) {
      const totalsRow =
        byCompanyMap.get(cid) ??
        ({
          companyId: toObjId(cid),
          total: 0,
          reviewed: 0,
          unreviewed: 0,
        } as ByCompanyRow);

      const rows = byCompanyProdMap.get(cid) ?? [];

      perCompany.push({
        companyId: cid,
        companyName: companyNameMap.get(cid) ?? "(unknown)",
        totals: {
          total: totalsRow.total ?? 0,
          reviewed: totalsRow.reviewed ?? 0,
          unreviewed: totalsRow.unreviewed ?? 0,
        },
        byProduct: rows.map((r) => ({
          productId: r.productId ? String(r.productId) : "",
          productName: r.productName,
          total: r.total,
          reviewed: r.reviewed,
          unreviewed: r.unreviewed,
        })),
      });
    }

    // overall totals
    const totals = perCompany.reduce(
      (acc, c) => {
        acc.total += c.totals.total;
        acc.reviewed += c.totals.reviewed;
        acc.unreviewed += c.totals.unreviewed;
        return acc;
      },
      { total: 0, reviewed: 0, unreviewed: 0 }
    );

    return ok({ workingDay, companies: perCompany, totals });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
