// D:\DataVerse\lead-suite\apps\web\src\app\api\dashboard\signup-summary\matrix\route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import User from "@/models/User";
import Company from "@/models/Company";
import Screenshot from "@/models/Screenshot";

/* ---------- Types ---------- */
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

type ProductsAggRow = {
  companyId: mongoose.Types.ObjectId;
  productName: string;
};

type CountsAggRow = {
  companyId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId | null;
  productName: string;
  count: number;
  name?: string;
  employeeId?: string | null;
};

type AppSession = Session & {
  userId?: string | null;
  user?: Session["user"] & {
    id?: string | null;
  };
};

const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });
const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

/* ---------- Helpers ---------- */
function ensureIsoDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function toStringId(id: string | mongoose.Types.ObjectId): string {
  return typeof id === "string" ? id : id.toString();
}

function objId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

function getSessionUserId(session: AppSession | null): string {
  if (!session) return "";
  return (
    (session.userId ?? null) ||
    (session.user?.id ?? null) ||
    ""
  ).toString();
}

/* ---------- Route ---------- */
export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user) return err("Unauthorized", 401);

    const url = new URL(req.url);
    const workingDay = url.searchParams.get("workingDay") || "";
    if (!ensureIsoDate(workingDay)) {
      return err("Invalid workingDay (YYYY-MM-DD)", 400);
    }

    await connectDB();

    // memberships → companies
    const userId = getSessionUserId(session);
    const user = await User.findById(userId, {
      memberships: 1,
    }).lean<UserLean>();

    const membershipCompanyIds: string[] = (user?.memberships ?? [])
      .map((m) => toStringId(m.companyId))
      .filter(Boolean);

    if (membershipCompanyIds.length === 0) {
      return ok({ workingDay, companies: [], isAdmin: false });
    }

    // keep only companies with receiver/hybrid (and receive allowed)
    const companies = await Company.find(
      {
        _id: { $in: membershipCompanyIds.map(objId) },
        roleMode: { $in: ["receiver", "hybrid"] },
        active: { $ne: false },
        $or: [
          { "allows.receiveLeads": { $exists: false } },
          { "allows.receiveLeads": true },
        ],
      },
      { _id: 1, name: 1 }
    ).lean<CompanyLean[]>();

    const allowedCompanyIds = companies.map((c) => toStringId(c._id));
    if (allowedCompanyIds.length === 0) {
      return ok({ workingDay, companies: [], isAdmin: false });
    }

    const matchStage: {
      companyId: { $in: mongoose.Types.ObjectId[] };
      workingDay: string;
    } = {
      companyId: { $in: allowedCompanyIds.map(objId) },
      workingDay,
    };

    // Distinct products per company (ordered headers)
    const productsAgg = await Screenshot.aggregate<ProductsAggRow>([
      { $match: matchStage },
      {
        $group: {
          _id: { companyId: "$companyId", productName: "$productName" },
        },
      },
      {
        $project: {
          _id: 0,
          companyId: "$_id.companyId",
          productName: "$_id.productName",
        },
      },
      { $sort: { productName: 1 } },
    ]);

    // Counts per (company, uploader, product)
    const countsAgg = await Screenshot.aggregate<CountsAggRow>([
      { $match: matchStage },
      {
        $group: {
          _id: {
            companyId: "$companyId",
            uploadedBy: "$uploadedBy",
            productName: "$productName",
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          companyId: "$_id.companyId",
          uploadedBy: "$_id.uploadedBy",
          productName: "$_id.productName",
          count: 1,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "uploadedBy",
          foreignField: "_id",
          as: "u",
          pipeline: [{ $project: { name: 1, employeeId: 1 } }],
        },
      },
      {
        $addFields: {
          name: { $ifNull: [{ $arrayElemAt: ["$u.name", 0] }, "(Unknown)"] },
          employeeId: {
            $ifNull: [{ $arrayElemAt: ["$u.employeeId", 0] }, null],
          },
        },
      },
      { $project: { u: 0 } },
    ]);

    // Build per-company matrices
    const companyName = new Map<string, string>(
      companies.map((c) => [toStringId(c._id), c.name])
    );

    const productHeadersByCompany = new Map<string, string[]>();
    for (const row of productsAgg) {
      const cid = toStringId(row.companyId);
      if (!productHeadersByCompany.has(cid))
        productHeadersByCompany.set(cid, []);
      productHeadersByCompany.get(cid)!.push(row.productName);
    }

    // uploader rows map: key companyId -> Map<uploaderId, row>
    const rowsByCompany: Map<
      string,
      Map<
        string,
        {
          _id: string; // uploader id or "null"
          employeeId: string | null;
          name: string;
          total: number;
          products: Record<string, number>; // productName -> count
        }
      >
    > = new Map();

    for (const r of countsAgg) {
      const cid = toStringId(r.companyId);
      const uid = r.uploadedBy ? toStringId(r.uploadedBy) : "null";
      const pname = r.productName;
      const count = r.count ?? 0;

      if (!rowsByCompany.has(cid)) rowsByCompany.set(cid, new Map());
      const cmap = rowsByCompany.get(cid)!;

      if (!cmap.has(uid)) {
        cmap.set(uid, {
          _id: uid,
          employeeId: r.employeeId ?? null,
          name: r.name ?? "(Unknown)",
          total: 0,
          products: {},
        });
      }
      const row = cmap.get(uid)!;
      row.products[pname] = (row.products[pname] ?? 0) + count;
      row.total += count;
    }

    // isAdmin? (any admin/superadmin membership)
    const isAdmin =
      (user?.memberships ?? []).some(
        (m) => m.role === "admin" || m.role === "superadmin"
      ) || false;

    const companiesOut = allowedCompanyIds.map((cid) => {
      const orderedProducts = productHeadersByCompany.get(cid) ?? [];
      const cmap = rowsByCompany.get(cid) ?? new Map();

      // rows array
      const rows = Array.from(cmap.values());

      // column totals
      const columnTotals: Record<string, number> = {};
      for (const p of orderedProducts) columnTotals[p] = 0;
      for (const row of rows) {
        for (const p of orderedProducts) {
          columnTotals[p] += row.products[p] ?? 0;
        }
      }

      return {
        companyId: cid,
        companyName: companyName.get(cid) ?? "(Unknown Company)",
        orderedProducts,
        rows,
        columnTotals,
      };
    });

    return ok({
      workingDay,
      isAdmin,
      companies: companiesOut,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
