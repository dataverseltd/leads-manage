// src/lib/getWorkingDay.ts

export function getWorkingDayBD(): string {
  const nowUTC = new Date();

  // Convert UTC → BDT
  const bdt = new Date(
    nowUTC.toLocaleString("en-US", { timeZone: "Asia/Dhaka" })
  );

  const hour = bdt.getHours();
  const minute = bdt.getMinutes();

  // ✅ If time is before 10:00 AM → assign to previous day
  if (hour < 10 || (hour === 10 && minute === 0)) {
    bdt.setDate(bdt.getDate() - 1);
  }

  // ✅ Remove time part and return only YYYY-MM-DD
  const year = bdt.getFullYear();
  const month = String(bdt.getMonth() + 1).padStart(2, "0");
  const day = String(bdt.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
