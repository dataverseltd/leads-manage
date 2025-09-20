// apps/web/src/app/api/employee/screenshots/upload/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { connectDB } from "@/lib/db";
import mongoose, { Types } from "mongoose";
import Screenshot from "@/models/Screenshot";
import CompanyMonthlyProduct from "@/models/CompanyMonthlyProduct";
import Lead from "@/models/Lead";
import Ably from "ably";

/* ---------------- Types ---------------- */
type AppSession = Session & { userId?: string | null };

type LeadLean = {
  _id: Types.ObjectId;
  assignedCompanyId?: Types.ObjectId | string | null;
};

type ProductLean = {
  _id: Types.ObjectId;
  name: string;
  month: string; // "YYYY-MM"
  companyId: Types.ObjectId;
  active?: boolean;
};

type PostBody = {
  leadId?: string;
  url?: string;
  productId?: string;
  workingDay?: string; // "YYYY-MM-DD"
};

/* ---------------- Utils ---------------- */
const RE_WORKING_DAY = /^\d{4}-\d{2}-\d{2}$/;

const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });
const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const isObjectIdString = (v: unknown): v is string =>
  typeof v === "string" && mongoose.Types.ObjectId.isValid(v);

const toObjectId = (v: string) => new mongoose.Types.ObjectId(v);

/** Minimal interface for Ably channels we call `publish` on */
type Publishable = {
  publish: (name: string, data: unknown, cb: (e?: unknown) => void) => void;
};

const publish = (ch: Publishable, name: string, data: unknown) =>
  new Promise<void>((resolve, reject) => {
    ch.publish(name, data, (err?: unknown) => (err ? reject(err) : resolve()));
  });

const withTimeout = (p: Promise<void>, ms = 5000) =>
  Promise.race([
    p,
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]) as Promise<void>;

/** Fire-and-forget helper (never throw into the main request) */
function fireAndForget(fn: () => Promise<unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  (async () => {
    try {
      await fn();
    } catch (e) {
      // Intentionally swallowed; log for diagnostics only
      console.warn("[screenshots/upload bg-task]", e);
    }
  })();
}

/* ---------------- Route ---------------- */
/**
 * POST /api/employee/screenshots/upload
 * body: { leadId: string, url: string, productId: string, workingDay: "YYYY-MM-DD" }
 */
export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user) return err("Unauthorized", 401);

    let body: PostBody = {};
    try {
      body = (await req.json()) as PostBody;
    } catch {
      /* no-op: body stays {} */
    }

    const { leadId, url, productId, workingDay } = body;

    // Input validation (fast-fail without touching DB)
    if (!isObjectIdString(leadId)) return err("Invalid leadId", 400);
    if (!isObjectIdString(productId)) return err("Invalid productId", 400);
    if (typeof url !== "string" || !url.trim()) return err("Invalid url", 400);
    if (typeof workingDay !== "string" || !RE_WORKING_DAY.test(workingDay)) {
      return err("Invalid workingDay", 400);
    }

    await connectDB();

    // Load lead (assigned company is source of truth for company scope)
    const lead = await Lead.findById(leadId).lean<LeadLean | null>();
    if (!lead) return err("Lead not found", 404);

    const assignedCompanyId = lead.assignedCompanyId;
    if (!assignedCompanyId || !isObjectIdString(String(assignedCompanyId))) {
      return err("Lead has no assignedCompanyId", 400);
    }
    const companyId = toObjectId(String(assignedCompanyId));

    // Validate product belongs to same company & month
    const productDoc = await CompanyMonthlyProduct.findById(
      productId
    ).lean<ProductLean | null>();
    if (!productDoc) return err("Product not found", 404);
    if (productDoc.active === false) return err("Product is inactive", 400);

    const monthFromDay = workingDay.slice(0, 7); // "YYYY-MM"
    if (productDoc.month !== monthFromDay) {
      return err(
        `Product belongs to ${productDoc.month}, but workingDay is ${monthFromDay}`,
        400
      );
    }
    if (String(productDoc.companyId) !== String(companyId)) {
      return err("Product and lead belong to different companies", 403);
    }

    // UploadedBy from session (optional)
    const uploadedBy =
      typeof session.userId === "string" &&
      mongoose.Types.ObjectId.isValid(session.userId)
        ? toObjectId(session.userId)
        : undefined;

    // Create screenshot (DB is authoritative)
    const created = await Screenshot.create({
      lead: toObjectId(leadId),
      url: url.trim(),
      uploadedBy: uploadedBy ?? null,
      uploadedAt: new Date(),
      workingDay,
      reviewed: false,
      companyId,

      // required schema fields:
      productId: toObjectId(String(productDoc._id)),
      productName: String(productDoc.name).trim(),
      productMonth: productDoc.month,

      // legacy compatibility:
      product: String(productDoc.name).trim(),
    });

    // Build a minimal response for the caller (don’t expose internals)
    const responsePayload = {
      _id: String(created._id),
      productName: created.productName,
      productMonth: created.productMonth,
      workingDay: created.workingDay,
      url: created.url,
    };

    // Send HTTP response immediately — do not await background work
    const response = ok(responsePayload, 201);

    /* ---------- Background tasks (non-blocking) ---------- */

    // 1) Ably publishes (company streams + day stream)
    fireAndForget(async () => {
      const ablyKey = process.env.ABLY_API_KEY;
      if (!ablyKey) {
        console.warn(
          "[screenshots/upload] Ably publish skipped: no ABLY_API_KEY"
        );
        return;
      }
      const rest = new Ably.Rest({ key: ablyKey });

      const payload = {
        _id: String(created._id),
        lead: String(created.lead),
        url: created.url,
        productId: String(created.productId),
        productName: created.productName,
        productMonth: created.productMonth, // "YYYY-MM"
        workingDay: created.workingDay, // "YYYY-MM-DD"
        uploadedAt: created.uploadedAt,
        uploadedBy: created.uploadedBy ? String(created.uploadedBy) : null,
        companyId: created.companyId ? String(created.companyId) : null,
        reviewed: !!created.reviewed,
      };

      const cid = payload.companyId || "unknown";
      const chAll = rest.channels.get(
        `companies.${cid}.screenshots`
      ) as unknown as Publishable;
      const chDay = rest.channels.get(
        `companies.${cid}.screenshots.${payload.workingDay}`
      ) as unknown as Publishable;

      await Promise.allSettled([
        withTimeout(publish(chAll, "uploaded", payload), 5000),
        withTimeout(publish(chDay, "uploaded", payload), 5000),
      ]);
    });

    // 2) Push broadcast (server endpoint) — fire-and-forget
    fireAndForget(async () => {
      const rawServer = process.env.SERVER_API_URL || "http://127.0.0.1:4000";
      const SECRET = process.env.PUSH_BROADCAST_SECRET;
      if (!SECRET) return;

      // make localhost→127.0.0.1 substitution (avoids some Node DNS oddities)
      const SERVER_API = rawServer.replace("localhost", "127.0.0.1");

      const payload = {
        companyId: String(created.companyId),
        title: "New Signup Screenshot",
        body: created.productName,
        data: {
          type: "screenshot.uploaded",
          productName: created.productName,
          workingDay: created.workingDay,
          screenshotId: String(created._id),
          url: "/dashboard/signup-summary",
        },
      };

      // Use AbortController to avoid hanging resources
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);

      try {
        await fetch(`${SERVER_API}/api/push/broadcast/screenshot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-push-secret": SECRET,
          },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
          // keepalive is best-effort; still add abort protection above
          keepalive: true,
        });
      } finally {
        clearTimeout(t);
      }
    });

    return response;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}