// apps/web/src/lib/server-api.ts
export const SERVER_API = (
  process.env.SERVER_API_URL || "http://127.0.0.1:4000"
).replace("localhost", "127.0.0.1");
