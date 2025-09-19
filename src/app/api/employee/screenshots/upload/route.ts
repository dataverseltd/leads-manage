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

type AppSession = Session & { userId?: string };

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
  workingDay?: string;
};

// Minimal interface for Ably channels we call `publish` on
type PublishableChannel = {
  publish: (
    name: string,
    data: unknown,
    callback: (err?: unknown) => void
  ) => void;
};

// Promise wrapper for Ably publish
const publish = (ch: PublishableChannel, name: string, data: unknown) =>
  new Promise<void>((resolve, reject) => {
    ch.publish(name, data, (err?: unknown) => (err ? reject(err) : resolve()));
  });

const withTimeout = (p: Promise<void>, ms = 5000) =>
  Promise.race([p, new Promise<void>((resolve) => setTimeout(resolve, ms))]);

const ok = <T>(data: T, status = 200) => NextResponse.json(data, { status });
const err = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

const isObjectIdString = (v: unknown): v is string =>
  typeof v === "string" && mongoose.Types.ObjectId.isValid(v);

/**
 * POST /api/employee/screenshots/upload
 * body: { leadId: string, url: string, productId: string, workingDay: "YYYY-MM-DD" }
 */
export async function POST(req: NextRequest) {
  try {
    const session = (await getServerSession(authOptions)) as AppSession | null;
    if (!session?.user) return err("Unauthorized", 401);

    let body: PostBody;
    try {
      body = (await req.json()) as PostBody;
    } catch {
      body = {};
    }
    const { leadId, url, productId, workingDay } = body;

    if (!isObjectIdString(leadId)) return err("Invalid leadId", 400);
    if (!isObjectIdString(productId)) return err("Invalid productId", 400);
    if (typeof url !== "string" || !url.trim()) return err("Invalid url", 400);
    if (
      typeof workingDay !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(workingDay)
    ) {
      return err("Invalid workingDay", 400);
    }

    await connectDB();

    const lead = await Lead.findById(leadId).lean<LeadLean | null>();
    if (!lead) return err("Lead not found", 404);

    const assignedCompanyId = lead.assignedCompanyId;
    if (!assignedCompanyId || !isObjectIdString(String(assignedCompanyId))) {
      return err("Lead has no assignedCompanyId", 400);
    }
    const companyId = new mongoose.Types.ObjectId(String(assignedCompanyId));

    const productDoc = await CompanyMonthlyProduct.findById(
      productId
    ).lean<ProductLean | null>();
    if (!productDoc) return err("Product not found", 404);
    if (productDoc.active === false) return err("Product is inactive", 400);

    const dayMonth = workingDay.slice(0, 7); // "YYYY-MM"
    if (productDoc.month !== dayMonth) {
      return err(
        `Product belongs to ${productDoc.month}, but workingDay is ${dayMonth}`,
        400
      );
    }
    if (String(productDoc.companyId) !== String(companyId)) {
      return err("Product and lead belong to different companies", 403);
    }

    const sessionUserId = session.userId;
    const uploadedBy =
      typeof sessionUserId === "string" &&
      mongoose.Types.ObjectId.isValid(sessionUserId)
        ? new mongoose.Types.ObjectId(sessionUserId)
        : null;

    // Create screenshot
    const created = await Screenshot.create({
      lead: new mongoose.Types.ObjectId(leadId),
      url: url.trim(),
      uploadedBy,
      uploadedAt: new Date(),
      workingDay,
      reviewed: false,
      companyId,

      // required schema fields:
      productId: new mongoose.Types.ObjectId(productDoc._id),
      productName: String(productDoc.name).trim(),
      productMonth: productDoc.month,

      // legacy compatibility:
      product: String(productDoc.name).trim(),
    });

    // immediate HTTP response (so UI is never stuck on "Uploading…")
    const respBody = {
      _id: String(created._id),
      productName: productDoc.name,
      productMonth: productDoc.month,
    };
    const response = ok(respBody, 201);

    // —— Ably publish (fire-and-forget, never block the response) ——
    (async () => {
      try {
        const ablyKey = process.env.ABLY_API_KEY;
        if (!ablyKey) {
          console.warn(
            "[screenshots/upload] Skipping Ably publish: no ABLY_API_KEY in apps/web env"
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

        const companyIdStr = payload.companyId || "unknown";
        const chAll = rest.channels.get(
          `companies.${companyIdStr}.screenshots`
        ) as unknown as PublishableChannel;
        const chDay = rest.channels.get(
          `companies.${companyIdStr}.screenshots.${payload.workingDay}`
        ) as unknown as PublishableChannel;

        await Promise.allSettled([
          withTimeout(publish(chAll, "uploaded", payload), 5000),
          withTimeout(publish(chDay, "uploaded", payload), 5000),
        ]);
      } catch (e) {
        console.warn("[screenshots/upload] Ably publish failed (bg):", e);
      }
    })();
    (async () => {
      try {
        const SERVER_API = (
          process.env.SERVER_API_URL || "http://127.0.0.1:4000"
        ).replace("localhost", "127.0.0.1");
        const SECRET = process.env.PUSH_BROADCAST_SECRET; // same value as server
        if (!SERVER_API || !SECRET) return;

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

        // Don’t await; keep it non-blocking
        fetch(`${SERVER_API}/api/push/broadcast/screenshot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-push-secret": SECRET,
          },
          body: JSON.stringify(payload),
          keepalive: true, // hint for node/fetch to allow after response
        }).catch(() => {});
      } catch {} // swallow
    })();
    return response;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return err(message, 500);
  }
}
