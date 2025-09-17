// ./src/lib/company.ts
import { NextRequest } from "next/server";

type SessionWithCompany = {
  activeCompanyId?: string | null;
} | null;

export function resolveCompanyId(
  req: NextRequest,
  session: SessionWithCompany
) {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("companyId");
  const fromHeader = req.headers.get("x-company-id");
  const fromSession = session?.activeCompanyId;
  return fromQuery || fromHeader || fromSession || null;
}
