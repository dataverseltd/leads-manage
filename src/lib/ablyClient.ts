import Ably from "ably"; // browser build

export function getRealtime(companyId: string) {
  return new Ably.Realtime({
    authUrl: `/api/ably/token?companyId=${encodeURIComponent(companyId)}`,
  });
}
