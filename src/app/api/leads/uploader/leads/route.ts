export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";
import { authOptions } from "@/lib/auth-options";

function num(v: string | null, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : d; // cap pageSize
}

/**
 * GET /api/uploader/leads
 * Query: page=1&pageSize=20&q=&status=&workingDay=
 * Scopes by submitted_by = session.userId
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session as any).userId as string | undefined;
  const activeCompanyId = (session as any).activeCompanyId as
    | string
    | undefined;
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

  // 🔄 Build ONE filter and reuse it everywhere
  const baseFilter: any = { submitted_by: userId };
  if (status) baseFilter.lead_status = status;
  if (workingDay) baseFilter.workingDay = workingDay;

  // ✅ For "My uploads", scope by sourceCompanyId (NOT assignedCompanyId)
  if (activeCompanyId) {
    baseFilter.sourceCompanyId = activeCompanyId;
    // If you prefer no company scoping on this page, just remove the above line.
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

  // (Optional) one-time sanity log
  // console.log({ userId, activeCompanyId, baseFilter, count: await Lead.countDocuments(baseFilter) });

  const [items, total, workingDays] = await Promise.all([
    Lead.find(baseFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean()
      .exec(),
    Lead.countDocuments(baseFilter).exec(),
    Lead.distinct("workingDay", baseFilter).exec(), // 🔁 same filter
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
