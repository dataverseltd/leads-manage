export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import CompanyMonthlyProduct from "@/models/CompanyMonthlyProduct";
import User from "@/models/User";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}
function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * GET /api/products?month=YYYY-MM[&companyId=...]
 * Returns active products { _id, name }[] for the requested month and company.
 * If companyId is missing, defaults to the user's active membership (first).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return err("Unauthorized", 401);

    const url = new URL(req.url);
    const month = url.searchParams.get("month") || "";
    const companyIdQ = url.searchParams.get("companyId") || "";

    if (!/^\d{4}-\d{2}$/.test(month))
      return err("Invalid or missing month=YYYY-MM", 400);

    await connectDB();

    // Resolve companyId
    let companyId = companyIdQ;
    if (!companyId) {
      const userId = (session as any).userId || null;
      const email = session.user.email || null;
      const user =
        (userId && (await User.findById(userId).lean())) ||
        (email && (await User.findOne({ email }).lean()));
      const mems: any[] = Array.isArray(user?.memberships)
        ? user!.memberships
        : [];
      if (!mems.length) return json([], 200);
      companyId = String(mems[0].companyId); // pick first membership if not provided
    }

    const docs = await CompanyMonthlyProduct.find(
      { companyId, month, active: true },
      { name: 1 }
    )
      .sort({ order: 1, name: 1 })
      .lean();

    return json(
      docs.map((d) => ({ _id: String(d._id), name: d.name, month })),
      200
    );
  } catch (e: any) {
    return err(e?.message || "Server error", 500);
  }
}
