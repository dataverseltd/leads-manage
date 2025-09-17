export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import Screenshot from "@/models/Screenshot";
type ScreenshotLean = {
  _id: mongoose.Types.ObjectId;
  url: string;
  product: string;
  productName: string;
  lead: mongoose.Types.ObjectId;
  workingDay: string; // "YYYY-MM-DD"
  companyId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
};

const ok = (data: any, status = 200) => NextResponse.json(data, { status });
const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const isObjectId = (v: unknown): v is string =>
  typeof v === "string" && mongoose.Types.ObjectId.isValid(v);

/**
 * DELETE /api/employee/screenshots/delete
 * body: { id: string }
 *
 * AuthZ:
 *  - superadmin/admin can delete any (optionally scoped by companyId if session has it)
 *  - otherwise only the original uploader (uploadedBy) can delete
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return err("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const id = body?.id as string;

    if (!isObjectId(id)) return err("Invalid id", 400);

    await connectDB();

    const doc = await Screenshot.findById(id).lean<ScreenshotLean>();
    if (!doc) return err("Not found", 404);

    const role: string = (session as any)?.role || "";
    const userId: string | null = (session as any)?.userId || null;
    const activeCompanyId: string | null =
      (session as any)?.activeCompanyId || null;

    // company scoping (if session has a company, ensure the screenshot belongs to it)
    if (isObjectId(activeCompanyId)) {
      if (String(doc.companyId || "") !== String(activeCompanyId)) {
        return err("Forbidden (company mismatch)", 403);
      }
    }

    const isAdmin = role === "superadmin" || role === "admin";

    // uploader check
    const isUploader =
      !!userId &&
      mongoose.Types.ObjectId.isValid(userId) &&
      String(doc.uploadedBy || "") === String(userId);

    if (!isAdmin && !isUploader) {
      return err("Forbidden", 403);
    }

    await Screenshot.deleteOne({ _id: id });

    return ok({ success: true });
  } catch (e: any) {
    return err(e?.message || "Server error", 500);
  }
}
