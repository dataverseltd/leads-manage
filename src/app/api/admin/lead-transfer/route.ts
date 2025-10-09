import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Company from "@/models/Company";
import { Types } from "mongoose";

const RAW = process.env.SERVER_API_URL || "http://127.0.0.1:4000";
const SERVER_API = RAW.replace("localhost", "127.0.0.1");

type Role =
  | "superadmin"
  | "admin"
  | "lead_operator"
  | "fb_submitter"
  | "fb_analytics_viewer"
  | "";

type CustomSession = Session & {
  userId?: string | null;
  role?: Role | string | null;
  activeCompanyId?: string | null;
  sessionToken?: string | null;
  user?: {
    id?: string | null;
    role?: Role | string | null;
    activeCompanyId?: string | null;
    sessionToken?: string | null;
  };
};

function getSessionValue(
  s: CustomSession | null,
  keys: Array<
    keyof CustomSession | `user.${keyof NonNullable<CustomSession["user"]>}`
  >
): string {
  if (!s) return "";
  for (const k of keys) {
    if (k.startsWith("user.")) {
      const kk = k.split(".")[1] as keyof NonNullable<CustomSession["user"]>;
      const v = s.user?.[kk];
      if (typeof v === "string") return v;
      if (v != null) return String(v);
    } else {
      const v = s[k as keyof CustomSession];
      if (typeof v === "string") return v;
      if (v != null) return String(v);
    }
  }
  return "";
}

/* -------------------------------- GET -------------------------------- */
export async function GET(req: Request) {
  const session = (await getServerSession(authOptions)) as CustomSession | null;
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const xUserId = getSessionValue(session, ["userId", "user.id"]);
  const xRole = getSessionValue(session, ["role", "user.role"]);
  const xSessionToken = getSessionValue(session, [
    "sessionToken",
    "user.sessionToken",
  ]);

  await connectDB();

  // find receiver/hybrid companies for this user
  const user = await User.findById(xUserId)
    .select("memberships")
    .lean<{ memberships?: { companyId: Types.ObjectId }[] }>();

  const companyIds = (user?.memberships || []).map((m) => m.companyId);
  const receiverCompanies = await Company.find({
    _id: { $in: companyIds },
    roleMode: { $in: ["receiver", "hybrid"] },
    active: true,
  })
    .select("_id name code roleMode")
    .lean();

  if (!receiverCompanies.length) {
    return NextResponse.json(
      { error: "No receiver company access found." },
      { status: 403 }
    );
  }

  // default to first receiver company
  const companyId = String(receiverCompanies[0]._id);

  const r = await fetch(`${SERVER_API}/api/admin/lead-transfer/operators`, {
    method: "GET",
    cache: "no-store",
    headers: {
      "x-user-id": xUserId,
      "x-company-id": companyId,
      "x-role": xRole,
      "x-session-token": xSessionToken,
    },
  });

  const data = await r.text();
  return new NextResponse(data, {
    status: r.status,
    headers: {
      "Content-Type": r.headers.get("content-type") ?? "application/json",
    },
  });
}

/* -------------------------------- POST -------------------------------- */
export async function POST(req: Request) {
  const session = (await getServerSession(authOptions)) as CustomSession | null;
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bodyText = await req.text();

  const xUserId = getSessionValue(session, ["userId", "user.id"]);
  const xRole = getSessionValue(session, ["role", "user.role"]);
  const xSessionToken = getSessionValue(session, [
    "sessionToken",
    "user.sessionToken",
  ]);

  await connectDB();

  // find receiver/hybrid companies for this user
  const user = await User.findById(xUserId)
    .select("memberships")
    .lean<{ memberships?: { companyId: Types.ObjectId }[] }>();

  const companyIds = (user?.memberships || []).map((m) => m.companyId);
  const receiverCompanies = await Company.find({
    _id: { $in: companyIds },
    roleMode: { $in: ["receiver", "hybrid"] },
    active: true,
  })
    .select("_id name code roleMode")
    .lean();

  if (!receiverCompanies.length) {
    return NextResponse.json(
      { error: "No receiver company access found." },
      { status: 403 }
    );
  }

  const companyId = String(receiverCompanies[0]._id);

  const r = await fetch(`${SERVER_API}/api/admin/lead-transfer`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": xUserId,
      "x-company-id": companyId,
      "x-role": xRole,
      "x-session-token": xSessionToken,
    },
    body: bodyText,
  });

  const data = await r.text();
  return new NextResponse(data, {
    status: r.status,
    headers: {
      "Content-Type": r.headers.get("content-type") ?? "application/json",
    },
  });
}
