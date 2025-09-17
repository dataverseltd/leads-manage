export function getWorkingMonthBD(date = new Date()): string {
  // Asia/Dhaka offset handling (simple +06:00 approximated)
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const bdt = new Date(utc + 6 * 60 * 60000);
  const y = bdt.getFullYear();
  const m = String(bdt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
