import { NextRequest } from "next/server";

export function resolveCompanyId(req: NextRequest, session: any) {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("companyId");
  const fromHeader = req.headers.get("x-company-id");
  const fromSession = session?.activeCompanyId;
  return fromQuery || fromHeader || fromSession || null;
}
