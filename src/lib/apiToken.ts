// ./src/lib/apiToken.ts
import { authOptions } from "@/lib/auth-options";
import jwt from "jsonwebtoken";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";

const API_SECRET = process.env.API_JWT_SECRET!; // same as server
const API_ISS = process.env.NEXT_PUBLIC_API_JWT_ISS!;
const API_AUD = process.env.NEXT_PUBLIC_API_JWT_AUD!;

// Extend Session type with the custom fields your app stores
type CustomSession = Session & {
  userId?: string;
  sessionToken?: string;
};

export async function getApiJwt() {
  // ✅ no `any` here — cast to CustomSession
  const session = (await getServerSession(authOptions)) as CustomSession | null;
  if (!session) return null;

  const payload = {
    userId: session.userId ?? "",
    sessionToken: session.sessionToken ?? "",
  };

  return jwt.sign(payload, API_SECRET, {
    issuer: API_ISS,
    audience: API_AUD,
    expiresIn: "10m",
  });
}
