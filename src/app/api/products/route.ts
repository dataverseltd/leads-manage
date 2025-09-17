export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import CompanyMonthlyProduct from "@/models/CompanyMonthlyProduct";
import User from "@/models/User";
import { Types } from "mongoose";

type AppSession = Session & { userId?: string };

type Membership = {
  companyId?: Types.ObjectId | string;
  // other fields not needed here
};

type UserLean = {
  memberships?: Membership[];
};

const json = <T>(data: T, status = 200) => NextResponse.json(data, { status });
const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

/**
 * GET /api/products?month=YYYY-MM[&companyId=...]
 * Returns active products { _id, name }[] for the requested month and company.
 * If companyId is missing, defaults to the user's active membership (first).
 */
export async function GET(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
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
      const userId = session.userId || null;
      const email = session.user.email || null;
      const user =
        (userId && (await User.findById(userId).lean<UserLean>())) ||
        (email && (await User.findOne({ email }).lean<UserLean>())) ||
        null;

      const mems: Membership[] = Array.isArray(user?.memberships)
        ? user!.memberships!
        : [];
      if (!mems.length) return json<string[]>([], 200);
      companyId = String(mems[0].companyId ?? "");
      if (!companyId) return json<string[]>([], 200);
    }

    const docs = await CompanyMonthlyProduct.find(
      { companyId, month, active: true },
      { name: 1 }
    )
      .sort({ order: 1, name: 1 })
      .lean<{ _id: Types.ObjectId; name: string }[]>();

    return json(
      docs.map((d) => ({ _id: String(d._id), name: d.name, month })),
      200
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
