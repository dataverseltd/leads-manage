export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import Company from "@/models/Company";
import User from "@/models/User";
import { Types } from "mongoose";

/* ---------- Types ---------- */

type AppSession = Session & { userId?: string };
type Role =
  | "superadmin"
  | "admin"
  | "lead_operator"
  | "fb_submitter"
  | "fb_analytics_viewer"
  | "employee"
  | string;

type Membership = {
  companyId?: Types.ObjectId | string;
  role?: Role;
  can_create_user?: boolean;
};

type UserLean = {
  _id: Types.ObjectId;
  memberships?: Membership[];
};

type CompanyLean = {
  _id: Types.ObjectId;
  products?: string[];
};

type JsonObject = Record<string, unknown>;

const isPlainObject = (v: unknown): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

/* ---------- Helpers ---------- */

function canEditCompany(userDoc: UserLean | null, companyId: string): boolean {
  if (!userDoc) return false;
  const ms: Membership[] = Array.isArray(userDoc.memberships)
    ? userDoc.memberships
    : [];
  const m = ms.find((x) => String(x.companyId) === String(companyId));
  return (
    !!m &&
    (m.role === "superadmin" || m.role === "admin" || !!m.can_create_user)
  );
}

/* ---------- Routes ---------- */

/**
 * GET  -> returns { products: string[] }
 * POST -> body { name: string }  (adds a single product if not exists)
 * DELETE -> body { name: string } (removes a single product)
 * PUT  -> body { products: string[] } (replaces the whole list)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const company = await Company.findById(params.companyId)
      .select("products")
      .lean<CompanyLean | null>();
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ products: company.products ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const userId = session.userId;
    const userDoc = userId
      ? await User.findById(userId).lean<UserLean>()
      : null;

    if (!canEditCompany(userDoc, params.companyId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let bodyUnknown: unknown;
    try {
      bodyUnknown = await req.json();
    } catch {
      bodyUnknown = {};
    }
    const body: JsonObject = isPlainObject(bodyUnknown) ? bodyUnknown : {};

    const raw = typeof body.name === "string" ? body.name.trim() : "";
    if (!raw) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    const name = raw.slice(0, 80); // limit length a bit
    const updated = await Company.findByIdAndUpdate(
      params.companyId,
      { $addToSet: { products: name } },
      { new: true, projection: { products: 1 } }
    ).lean<CompanyLean | null>();

    if (!updated) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, products: updated.products ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const userId = session.userId;
    const userDoc = userId
      ? await User.findById(userId).lean<UserLean>()
      : null;

    if (!canEditCompany(userDoc, params.companyId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let bodyUnknown: unknown;
    try {
      bodyUnknown = await req.json();
    } catch {
      bodyUnknown = {};
    }
    const body: JsonObject = isPlainObject(bodyUnknown) ? bodyUnknown : {};
    const raw = typeof body.name === "string" ? body.name.trim() : "";
    if (!raw) {
      return NextResponse.json({ error: "Missing name" }, { status: 400 });
    }

    const updated = await Company.findByIdAndUpdate(
      params.companyId,
      { $pull: { products: raw } },
      { new: true, projection: { products: 1 } }
    ).lean<CompanyLean | null>();

    if (!updated) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, products: updated.products ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const userId = session.userId;
    const userDoc = userId
      ? await User.findById(userId).lean<UserLean>()
      : null;

    if (!canEditCompany(userDoc, params.companyId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let bodyUnknown: unknown;
    try {
      bodyUnknown = await req.json();
    } catch {
      bodyUnknown = {};
    }
    const body: JsonObject = isPlainObject(bodyUnknown) ? bodyUnknown : {};
    const listUnknown = body.products;

    const products = (isStringArray(listUnknown) ? listUnknown : [])
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.slice(0, 80));

    const updated = await Company.findByIdAndUpdate(
      params.companyId,
      { $set: { products } },
      { new: true, projection: { products: 1 } }
    ).lean<CompanyLean | null>();

    if (!updated) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, products: updated.products ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
