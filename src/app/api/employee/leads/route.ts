import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";
import Screenshot from "@/models/Screenshot";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session as any).userId as string;
  const caps = (session as any).caps || {};
  if (
    !userId ||
    (!caps.canReceiveLeads && (session as any).role === "fb_submitter")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();

  const url = new URL(req.url);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1"), 1);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "30"), 10),
    100
  );
  const workingDay = (url.searchParams.get("workingDay") || "").trim();
  const q = (url.searchParams.get("q") || "").trim();
  const status = url.searchParams.get("status") as
    | "assigned"
    | "approved"
    | "rejected"
    | ""
    | null;

  const filter: any = {
    ...(workingDay ? { workingDay } : {}),
    ...(status ? { lead_status: status } : {}),
    ...(q
      ? {
          $or: [
            { number: { $regex: q, $options: "i" } },
            { address: { $regex: q, $options: "i" } },
            { fb_id_name: { $regex: q, $options: "i" } },
            { client_name: { $regex: q, $options: "i" } },
          ],
        }
      : {}),
    $expr: { $eq: [{ $toString: "$assigned_to" }, userId] },
  };

  // Fetch limit+1 to detect hasMore (avoid countDocuments)
  const docs = await Lead.find(filter)
    .select(
      "_id client_name number fb_id_name lead_status workingDay rent house_apt house_apt_details address post_link assigned_to createdAt"
    )
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit + 1)
    .lean();

  const items = docs.slice(0, limit);
  const hasMore = docs.length > limit;

  // Per-page screenshot counts only for these items
  let byLeadShotCount: Record<string, number> = {};
  if (items.length) {
    const ids = items.map((x: any) => x._id);
    const agg = await Screenshot.aggregate([
      { $match: { lead: { $in: ids } } },
      { $group: { _id: "$lead", c: { $sum: 1 } } },
    ]);
    byLeadShotCount = Object.fromEntries(
      agg.map((r: any) => [String(r._id), r.c])
    );
  }

  return NextResponse.json({ items, hasMore, byLeadShotCount });
}
