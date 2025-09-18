// apps/web/src/app/api/leads/uploader/leads/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";
import type { Session } from "next-auth";
import type { Types } from "mongoose";

function num(v: string | null, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : d; // cap pageSize
}

// Your session carries extra fields; type them instead of using `any`
type SessionWithIds = Session & {
  userId?: string;
  activeCompanyId?: string;
};

// Narrow the filter type to only what you use here (no `any`)
type LeadFilter = {
  submitted_by: string | Types.ObjectId;
  lead_status?: string;
  workingDay?: string;
  sourceCompanyId?: string | Types.ObjectId;
  $or?: Array<
    | { fb_id_name: RegExp }
    | { client_name: RegExp }
    | { number: RegExp }
    | { address: RegExp }
    | { post_link: RegExp }
  >;
};

export async function GET(req: Request) {
  const sessionRaw = await getServerSession(authOptions);
  if (!sessionRaw)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = sessionRaw as SessionWithIds;
  const userId = session.userId;
  const activeCompanyId = session.activeCompanyId;

  if (!userId) {
    return NextResponse.json(
      { error: "Missing user id in session" },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(req.url);
  const page = num(searchParams.get("page"), 1);
  const pageSize = num(searchParams.get("pageSize"), 20);
  const q = (searchParams.get("q") || "").trim();
  const status = (searchParams.get("status") || "").trim();
  const workingDay = (searchParams.get("workingDay") || "").trim();

  await connectDB();

  // Typed filter (no `any`)
  const baseFilter: LeadFilter = { submitted_by: userId };
  if (status) baseFilter.lead_status = status;
  if (workingDay) baseFilter.workingDay = workingDay;

  // Scope to sourceCompanyId for uploader's own uploads
  if (activeCompanyId) {
    baseFilter.sourceCompanyId = activeCompanyId;
  }

  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    baseFilter.$or = [
      { fb_id_name: rx },
      { client_name: rx },
      { number: rx },
      { address: rx },
      { post_link: rx },
    ];
  }

  const skip = (page - 1) * pageSize;

  const [items, total, workingDays] = await Promise.all([
    Lead.find(baseFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean()
      .exec(),
    Lead.countDocuments(baseFilter).exec(),
    Lead.distinct("workingDay", baseFilter).exec(),
  ]);

  return NextResponse.json(
    {
      items,
      page,
      pageSize,
      total,
      workingDays: workingDays.sort().reverse(),
    },
    { status: 200 }
  );
}
