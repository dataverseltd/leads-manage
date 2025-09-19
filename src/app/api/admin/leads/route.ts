export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth-options";

/* ---------------- Types & helpers ---------------- */
type SessionLike = {
  role?: "superadmin" | "admin" | string;
  caps?: Record<string, unknown>;
  activeCompanyId?: string;
};

function toInt(v: string | null, def: number) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : def;
}

function canViewAll(session: SessionLike | null | undefined): boolean {
  return (
    session?.role === "superadmin" ||
    session?.role === "admin" ||
    Boolean(
      (session?.caps as Record<string, boolean> | undefined)?.can_view_all_leads
    )
  );
}

/** turn e.g. "-createdAt" or "createdAt" into a sort object */
function parseSort(sortParam: string): Record<string, 1 | -1> {
  const key = sortParam.startsWith("-") ? sortParam.slice(1) : sortParam;
  const dir: 1 | -1 = sortParam.startsWith("-") ? -1 : 1;
  // default to createdAt if somehow empty
  return { [key || "createdAt"]: dir };
}

/* ---------------- Handler ---------------- */
export async function GET(req: Request) {
  const session = (await getServerSession(authOptions)) as SessionLike | null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canViewAll(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const workingDay = url.searchParams.get("workingDay") || "";
  const status = url.searchParams.get("status") || "";
  const search = url.searchParams.get("search") || "";
  const page = Math.max(toInt(url.searchParams.get("page"), 1), 1);
  const limit = Math.min(
    Math.max(toInt(url.searchParams.get("limit"), 25), 1),
    200
  );
  const sortParam = (url.searchParams.get("sort") || "-createdAt") as string;
  const sortObj = parseSort(sortParam);

  try {
    await connectDB();

    const q: Record<string, unknown> = {};
    if (workingDay) q.workingDay = workingDay;
    if (status) q.lead_status = status;

    if (search) {
      if (search.startsWith("text:")) {
        q.$text = { $search: search.slice(5).trim() };
      } else {
        const rx = new RegExp(
          search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i"
        );
        q.$or = [
          { fb_id_name: rx },
          { client_name: rx },
          { number: rx },
          { address: rx },
        ];
      }
    }

    // Optional company scoping
    const companyId = session.activeCompanyId;
    if (typeof companyId === "string" && mongoose.isValidObjectId(companyId)) {
      q.$and = ((q.$and as unknown[] | undefined) || []).concat([
        {
          $or: [
            { assignedCompanyId: companyId },
            { targetCompanyId: companyId },
            { sourceCompanyId: companyId },
          ],
        },
      ]);
    }

    const projection: Record<string, 0 | 1> = {
      fb_id_name: 1,
      client_name: 1,
      number: 1,
      rent: 1,
      submitted_by: 1,
      address: 1,
      post_link: 1,
      lead_status: 1,
      workingDay: 1,
      assigned_to: 1,
      createdAt: 1,
    };

    const [rows, total] = await Promise.all([
      Lead.find(q, projection)
        .lean()
        .sort(sortObj)
        .skip((page - 1) * limit)
        .limit(limit),
      Lead.countDocuments(q),
    ]);

    return NextResponse.json({
      page,
      limit,
      total,
      hasMore: page * limit < total,
      data: rows,
    });
  } catch (err: unknown) {
    console.error("GET /api/admin/leads failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
