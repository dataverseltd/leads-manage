// apps/web/src/app/dashboard/signup-summary/page.tsx
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getWorkingDayBD } from "@/lib/getWorkingDay";
import SummaryClient from "./summary-client";

export default async function Page() {
  // We don’t actually use the session here, but fetching ensures it exists
  const _session: Session | null = await getServerSession(authOptions);

  const workingDay = getWorkingDayBD(); // "YYYY-MM-DD" (BD working day)
  return <SummaryClient initialDay={workingDay} />;
}
