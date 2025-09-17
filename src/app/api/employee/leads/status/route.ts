export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectDB } from "@/lib/db";
import Lead from "@/models/Lead";

type AppSession = Session & { userId?: string };
type PutBody = { id?: string; status?: string };

export async function PUT(req: Request) {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    body = {};
  }

  if (!body.id || !body.status) {
    return NextResponse.json({ error: "Missing id/status" }, { status: 400 });
  }

  await connectDB();

  try {
    const lead = await Lead.findById(body.id);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Only allow if this user is assigned
    if (String(lead.assigned_to) !== String(session.userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    lead.lead_status = body.status;
    await lead.save();

    return NextResponse.json({
      ok: true,
      id: lead._id,
      status: lead.lead_status,
    });
  } catch (e: unknown) {
    console.error("Lead status update error:", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
