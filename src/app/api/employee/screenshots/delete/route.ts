export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";
import Screenshot from "@/models/Screenshot";

type AppSession = Session & {
  userId?: string;
  role?: string;
  activeCompanyId?: string;
};

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

type DeleteBody = { id?: string };

type JsonObject = Record<string, unknown>;
const isPlainObject = (v: unknown): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });
const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const isObjectIdString = (v: unknown): v is string =>
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
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user) return err("Unauthorized", 401);

    let bodyUnknown: unknown;
    try {
      bodyUnknown = await req.json();
    } catch {
      bodyUnknown = {};
    }
    const body: DeleteBody = isPlainObject(bodyUnknown)
      ? (bodyUnknown as DeleteBody)
      : {};

    const id = body.id;
    if (!isObjectIdString(id)) return err("Invalid id", 400);

    await connectDB();

    const doc = await Screenshot.findById(id).lean<ScreenshotLean | null>();
    if (!doc) return err("Not found", 404);

    const role = session.role ?? "";
    const userId = session.userId ?? null;
    const activeCompanyId = session.activeCompanyId ?? null;

    // company scoping (if session has a company, ensure the screenshot belongs to it)
    if (isObjectIdString(activeCompanyId)) {
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

    return ok({ success: true as const });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
