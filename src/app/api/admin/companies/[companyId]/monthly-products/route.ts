export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import Company from "@/models/Company";
import User from "@/models/User";
import mongoose from "mongoose";
import CompanyMonthlyProduct from "@/models/CompanyMonthlyProduct";

type Safe<T> = T | null | undefined;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

// ---- shared guard (respects uploader lock) ----
async function assertCanEditProducts(session: any, companyId: string) {
  if (!session?.user)
    throw Object.assign(new Error("Unauthorized"), { status: 401 });

  await connectDB();
  const company = await Company.findById(companyId).lean();
  if (!company)
    throw Object.assign(new Error("Company not found"), { status: 404 });

  if (company.roleMode === "uploader") {
    throw Object.assign(
      new Error("Editing products is disabled for upload-only companies"),
      { status: 403 }
    );
  }

  const userId = (session as any).userId as Safe<string>;
  const email = session.user.email as Safe<string>;

  const user =
    (userId && (await User.findById(userId).lean())) ||
    (email && (await User.findOne({ email }).lean()));

  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

  const memberships: any[] = Array.isArray(user.memberships)
    ? user.memberships
    : [];
  const isSuper = memberships.some((m) => m?.role === "superadmin");
  if (isSuper) return;

  const m = memberships.find(
    (mm) => String(mm.companyId) === String(companyId)
  );
  if (m && (m.role === "admin" || m.can_manage_products)) return;

  throw Object.assign(new Error("Forbidden"), { status: 403 });
}

function getMonth(req: NextRequest) {
  const url = new URL(req.url);
  const month = url.searchParams.get("month") || "";
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw Object.assign(new Error("Invalid or missing ?month=YYYY-MM"), {
      status: 400,
    });
  }
  return month;
}

// Utility: list products for company+month
async function listFor(companyId: string, month: string) {
  await connectDB();
  const items = await CompanyMonthlyProduct.find(
    { companyId, month, active: true },
    { name: 1, order: 1, active: 1 } // projection
  )
    .sort({ order: 1, name: 1 })
    .lean();

  // return trimmed shape
  return items.map((p) => ({
    _id: String(p._id),
    name: p.name,
    order: p.order ?? 0,
    active: !!p.active,
  }));
}

// GET -> read list (with optional fallback to latest available month if empty)
export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
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
        .lean();

      let fallback = null as any;
      if (latest?.month && latest.month !== month) {
        const fp = await listFor(params.companyId, latest.month);
        if (fp.length) {
          fallback = { month: latest.month, products: fp };
        }
      }

      return ok({ month, products: [], fallback });
    }

    return ok({ month, products });
  } catch (e: any) {
    return jsonError(e?.message || "Server error", e?.status || 500);
  }
}

// PUT -> replace all products for the month (upsert by name)
export async function PUT(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    await assertCanEditProducts(session, params.companyId);

    await connectDB();
    const month = getMonth(req);
    const body = await req.json().catch(() => ({} as any));
    const names: string[] = Array.isArray(body.products) ? body.products : [];

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

    // Optionally, deactivate products that are not in the new list
    await CompanyMonthlyProduct.updateMany(
      { companyId: params.companyId, month, name: { $nin: names } },
      { $set: { active: false } }
    );

    const products = await listFor(params.companyId, month);
    return ok({ month, products });
  } catch (e: any) {
    return jsonError(e?.message || "Forbidden", e?.status || 403);
  }
}

// POST -> add one product
export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
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
  } catch (e: any) {
    return jsonError(e?.message || "Forbidden", e?.status || 403);
  }
}

// DELETE -> remove one product (by id)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    await assertCanEditProducts(session, params.companyId);

    await connectDB();
    const month = getMonth(req);
    const { id } = (await req.json()) as { id?: string };

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
  } catch (e: any) {
    return jsonError(e?.message || "Forbidden", e?.status || 403);
  }
}
