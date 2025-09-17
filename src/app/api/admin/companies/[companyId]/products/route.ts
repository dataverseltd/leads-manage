export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import Company from "@/models/Company";
import User from "@/models/User";

function canEditCompany(userDoc: any, companyId: string) {
  if (!userDoc) return false;
  const ms = Array.isArray(userDoc.memberships) ? userDoc.memberships : [];
  const m = ms.find((x: any) => String(x.companyId) === String(companyId));
  // superadmin/admin or membership with can_create_user => allowed
  return (
    !!m &&
    (m.role === "superadmin" || m.role === "admin" || !!m.can_create_user)
  );
}

/**
 * GET  -> returns { products: string[] }
 * POST -> body { name: string }  (adds a single product if not exists)
 * DELETE -> body { name: string } (removes a single product)
 * PUT  -> body { products: string[] } (replaces the whole list)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();

    const company = await Company.findById(params.companyId)
      .select("products")
      .lean();
    if (!company)
      return NextResponse.json({ error: "Company not found" }, { status: 404 });

    return NextResponse.json({ products: company.products || [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();

    const userId = (session as any).userId as string | undefined;
    const userDoc = userId ? await User.findById(userId).lean() : null;

    if (!canEditCompany(userDoc, params.companyId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const raw = String(body?.name || "").trim();
    if (!raw)
      return NextResponse.json({ error: "Missing name" }, { status: 400 });

    const name = raw.slice(0, 80); // limit length a bit
    const updated = await Company.findByIdAndUpdate(
      params.companyId,
      { $addToSet: { products: name } },
      { new: true, projection: { products: 1 } }
    ).lean();

    if (!updated)
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    return NextResponse.json({ ok: true, products: updated.products || [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();

    const userId = (session as any).userId as string | undefined;
    const userDoc = userId ? await User.findById(userId).lean() : null;

    if (!canEditCompany(userDoc, params.companyId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const raw = String(body?.name || "").trim();
    if (!raw)
      return NextResponse.json({ error: "Missing name" }, { status: 400 });

    const updated = await Company.findByIdAndUpdate(
      params.companyId,
      { $pull: { products: raw } },
      { new: true, projection: { products: 1 } }
    ).lean();

    if (!updated)
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    return NextResponse.json({ ok: true, products: updated.products || [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();

    const userId = (session as any).userId as string | undefined;
    const userDoc = userId ? await User.findById(userId).lean() : null;

    if (!canEditCompany(userDoc, params.companyId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const list = Array.isArray(body?.products) ? body.products : [];
    const products = list
      .map((x: any) => String(x || "").trim())
      .filter(Boolean)
      .map((s: string) => s.slice(0, 80));

    const updated = await Company.findByIdAndUpdate(
      params.companyId,
      { $set: { products } },
      { new: true, projection: { products: 1 } }
    ).lean();

    if (!updated)
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    return NextResponse.json({ ok: true, products: updated.products || [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
