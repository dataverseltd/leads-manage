// apps/web/src/app/api/employee/leads/status/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead"; // adjust import path

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.status) {
    return NextResponse.json({ error: "Missing id/status" }, { status: 400 });
  }

  await connectDB();

  try {
    const lead = await Lead.findById(body.id);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // (optional) safety check: only allow status update if this user is assigned
    if (String(lead.assigned_to) !== String((session as any).userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    lead.lead_status = body.status;
    await lead.save();

    return NextResponse.json({
      ok: true,
      id: lead._id,
      status: lead.lead_status,
    });
  } catch (e: any) {
    console.error("Lead status update error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
