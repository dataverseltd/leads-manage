import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import jwt from "jsonwebtoken";
import { getServerSession } from "next-auth";

const API_SECRET = process.env.API_JWT_SECRET!; // same as server
const API_ISS = process.env.NEXT_PUBLIC_API_JWT_ISS!;
const API_AUD = process.env.NEXT_PUBLIC_API_JWT_AUD!;

export async function getApiJwt() {
  const session = await getServerSession(authOptions as any);
  if (!session) return null;
  const payload = {
    userId: (session as any).userId,
    sessionToken: (session as any).sessionToken,
  };
  return jwt.sign(payload, API_SECRET, {
    issuer: API_ISS,
    audience: API_AUD,
    expiresIn: "10m",
  });
}
