export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import Company from "@/models/Company";
import User from "@/models/User";
import mongoose, { Types } from "mongoose";
import CompanyMonthlyProduct from "@/models/CompanyMonthlyProduct";

/* ---------- Types ---------- */

type AppSession = Session & {
  userId?: string;
  role?: string;
  activeCompanyId?: string;
};

type Membership = {
  companyId?: Types.ObjectId;
  role?: "superadmin" | "admin" | "employee" | string;
  can_manage_products?: boolean;
};

type UserLean = {
  _id: Types.ObjectId;
  email?: string | null;
  memberships?: Membership[];
};

type CompanyLean = {
  _id: Types.ObjectId;
  roleMode: "uploader" | "receiver" | "hybrid";
};

type ListedProduct = {
  _id: string;
  name: string;
  order: number;
  active: boolean;
};

type PutBody = { products?: unknown };
type DeleteBody = { id?: string };

/* ---------- Helpers ---------- */

type WithStatus = Error & { status?: number };

const httpError = (message: string, status: number): WithStatus => {
  const e = new Error(message) as WithStatus;
  e.status = status;
  return e;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/** Shared guard (respects uploader lock) */
async function assertCanEditProducts(
  session: AppSession | null,
  companyId: string
) {
  if (!session?.user) throw httpError("Unauthorized", 401);

  await connectDB();

  // Only need roleMode; keep query lean & small
  const company = await Company.findById(companyId)
    .select({ roleMode: 1 })
    .lean<CompanyLean | null>();
  if (!company) throw httpError("Company not found", 404);

  if (company.roleMode === "uploader") {
    throw httpError(
      "Editing products is disabled for upload-only companies",
      403
    );
  }

  const userId = session.userId;
  const email = session.user.email ?? null;

  const user: UserLean | null =
    (userId && (await User.findById(userId).lean<UserLean>())) ||
    (email && (await User.findOne({ email }).lean<UserLean>())) ||
    null;

  if (!user) throw httpError("User not found", 404);

  const memberships: Membership[] = Array.isArray(user.memberships)
    ? user.memberships
    : [];
  const isSuper = memberships.some((m) => m?.role === "superadmin");
  if (isSuper) return;

  const m = memberships.find(
    (mm) => String(mm.companyId) === String(companyId)
  );
  if (m && (m.role === "admin" || !!m.can_manage_products)) return;

  throw httpError("Forbidden", 403);
}

function getMonth(req: NextRequest) {
  const url = new URL(req.url);
  const month = url.searchParams.get("month") || "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw httpError("Invalid or missing ?month=YYYY-MM", 400);
  }
  return month;
}

/** Utility: list products for company+month */
async function listFor(
  companyId: string,
  month: string
): Promise<ListedProduct[]> {
  await connectDB();
  const items = await CompanyMonthlyProduct.find(
    { companyId, month, active: true },
    { name: 1, order: 1, active: 1 } // projection
  )
    .sort({ order: 1, name: 1 })
    .lean<
      { _id: Types.ObjectId; name: string; order?: number; active?: boolean }[]
    >();

  return items.map((p) => ({
    _id: String(p._id),
    name: p.name,
    order: p.order ?? 0,
    active: !!p.active,
  }));
}

/* ---------- Routes ---------- */

// GET -> read list (with optional fallback to latest available month if empty)
export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user) return jsonError("Unauthorized", 401);

    await connectDB();
    const month = getMonth(req);

    const products = await listFor(params.companyId, month);

    if (products.length === 0) {
      // find latest any-month config for this company
      const latest = await CompanyMonthlyProduct.findOne(
        { companyId: params.companyId },
        { month: 1 }
      )
        .sort({ month: -1 })
        .lean<{ month: string } | null>();

      let fallback: { month: string; products: ListedProduct[] } | null = null;
      if (latest?.month && latest.month !== month) {
        const fp = await listFor(params.companyId, latest.month);
        if (fp.length) {
          fallback = { month: latest.month, products: fp };
        }
      }

      return ok({ month, products: [] as ListedProduct[], fallback });
    }

    return ok({ month, products });
  } catch (e: unknown) {
    const status = (e as WithStatus)?.status ?? 500;
    const message = e instanceof Error ? e.message : "Server error";
    return jsonError(message, status);
  }
}

// PUT -> replace all products for the month (upsert by name)
export async function PUT(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    await assertCanEditProducts(session, params.companyId);

    await connectDB();
    const month = getMonth(req);

    let body: PutBody;
    try {
      body = (await req.json()) as PutBody;
    } catch {
      body = {};
    }

    const names: string[] = isStringArray(body.products) ? body.products : [];

    // Upsert each product by (companyId, month, name)
    for (const rawName of names) {
      const name = String(rawName || "").trim();
      if (!name) continue;
      await CompanyMonthlyProduct.updateOne(
        { companyId: params.companyId, month, name },
        { $setOnInsert: { name, order: 0, active: true } },
        { upsert: true }
      );
    }

    // Deactivate products that are not in the new list
    await CompanyMonthlyProduct.updateMany(
      { companyId: params.companyId, month, name: { $nin: names } },
      { $set: { active: false } }
    );

    const products = await listFor(params.companyId, month);
    return ok({ month, products });
  } catch (e: unknown) {
    const status = (e as WithStatus)?.status ?? 403;
    const message = e instanceof Error ? e.message : "Forbidden";
    return jsonError(message, status);
  }
}

// POST -> add one product
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    await assertCanEditProducts(session, params.companyId);

    await connectDB();
    const month = getMonth(req);
    const { name } = (await req.json()) as { name?: string };

    const trimmed = String(name || "").trim();
    if (!trimmed) return jsonError("Missing product name", 400);

    // Upsert (keeps id stable if already exists)
    await CompanyMonthlyProduct.updateOne(
      { companyId: params.companyId, month, name: trimmed },
      { $set: { active: true } },
      { upsert: true }
    );

    const products = await listFor(params.companyId, month);
    return ok({ month, products });
  } catch (e: unknown) {
    const status = (e as WithStatus)?.status ?? 403;
    const message = e instanceof Error ? e.message : "Forbidden";
    return jsonError(message, status);
  }
}

// DELETE -> remove one product (by id)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    await assertCanEditProducts(session, params.companyId);

    await connectDB();
    const month = getMonth(req);
    const { id } = (await req.json()) as DeleteBody;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return jsonError("Missing or invalid product id", 400);
    }

    await CompanyMonthlyProduct.deleteOne({
      _id: new mongoose.Types.ObjectId(id),
      companyId: params.companyId,
      month,
    });

    const products = await listFor(params.companyId, month);
    return ok({ month, products });
  } catch (e: unknown) {
    const status = (e as WithStatus)?.status ?? 403;
    const message = e instanceof Error ? e.message : "Forbidden";
    return jsonError(message, status);
  }
}
