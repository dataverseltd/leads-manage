import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";
import Screenshot from "@/models/Screenshot";
import { Types, type FilterQuery } from "mongoose";

export const runtime = "nodejs";

type AppSession = Session & {
  userId?: string;
  role?: string;
  caps?: {
    canReceiveLeads?: boolean;
    [k: string]: unknown;
  };
};

type LeadStatus = "assigned" | "approved" | "rejected";

type LeadLean = {
  _id: Types.ObjectId;
  client_name?: string;
  number?: string;
  fb_id_name?: string;
  lead_status?: LeadStatus | "pending" | "in_progress" | "done";
  workingDay?: string;
  rent?: string;
  house_apt?: string;
  house_apt_details?: string;
  address?: string;
  post_link?: string;
  assigned_to?: Types.ObjectId | null;
  createdAt?: Date | string;
};

export async function GET(req: NextRequest) {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;
  const role = session.role;
  const caps = session.caps ?? {};

  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!caps.canReceiveLeads && role === "fb_submitter") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();

  const url = new URL(req.url);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "30", 10), 10),
    100
  );
  const workingDay = (url.searchParams.get("workingDay") || "").trim();
  const q = (url.searchParams.get("q") || "").trim();
  const statusParam = url.searchParams.get("status");
  const status: LeadStatus | "" | null =
    statusParam === "assigned" ||
    statusParam === "approved" ||
    statusParam === "rejected"
      ? statusParam
      : statusParam === "" || statusParam === null
      ? (statusParam as "" | null)
      : null;

  // Build filter (match assigned_to directly using ObjectId)
  const filter: FilterQuery<LeadLean> = {
    assigned_to: new Types.ObjectId(userId),
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
  };

  // Fetch limit+1 to detect hasMore (avoid countDocuments)
  const docs = await Lead.find(filter)
    .select(
      "_id client_name number fb_id_name lead_status workingDay rent house_apt house_apt_details address post_link assigned_to createdAt"
    )
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit + 1)
    .lean<LeadLean[]>();

  const items = docs.slice(0, limit);
  const hasMore = docs.length > limit;

  // Per-page screenshot counts only for these items
  let byLeadShotCount: Record<string, number> = {};
  if (items.length) {
    const ids = items.map((x) => x._id);
    const agg = (await Screenshot.aggregate([
      { $match: { lead: { $in: ids } } },
      { $group: { _id: "$lead", c: { $sum: 1 } } },
    ])) as Array<{ _id: Types.ObjectId; c: number }>;

    byLeadShotCount = Object.fromEntries(agg.map((r) => [String(r._id), r.c]));
  }

  return NextResponse.json({ items, hasMore, byLeadShotCount });
}
