// apps/web/src/hooks/useScreenshotRT.ts
"use client";

import { useEffect } from "react";
import Ably from "ably";
import { getRealtime } from "@/lib/ablyClient";

export type ScreenshotEvent = {
  _id: string;
  lead: string;
  url: string;
  productId: string;
  productName: string;
  productMonth: string; // "YYYY-MM"
  workingDay: string; // "YYYY-MM-DD"
  uploadedAt: string | Date;
  uploadedBy: string | null;
  companyId: string | null;
  reviewed: boolean;
  reviewedAt?: string | Date | null;
  reviewedBy?: string | null;
};

// Minimal channel/message shapes (no Ably.Types)
type Channel = {
  subscribe: (listener: (msg: Message) => void) => void;
  unsubscribe: (listener: (msg: Message) => void) => void;
};
type Message = { name: string; data: unknown };

type Options = {
  companyId: string;
  workingDay?: string;
  onUploaded?: (p: ScreenshotEvent) => void;
  onReviewed?: (p: ScreenshotEvent) => void;
  userId?: string;
  listenPersonal?: boolean;
};

export function useScreenshotRT(opts: Options) {
  const {
    companyId,
    workingDay,
    onUploaded,
    onReviewed,
    userId,
    listenPersonal,
  } = opts;

  useEffect(() => {
    if (!companyId) return;

    // getRealtime returns an Ably.Realtime instance
    const rt = getRealtime(companyId) as InstanceType<typeof Ably.Realtime>;

    const chCompany = rt.channels.get(
      `companies.${companyId}.screenshots`
    ) as unknown as Channel;
    const chDay = workingDay
      ? (rt.channels.get(
          `companies.${companyId}.screenshots.${workingDay}`
        ) as unknown as Channel)
      : null;
    const chPersonal =
      listenPersonal && userId
        ? (rt.channels.get(
            `companies.${companyId}.users.${userId}.screenshots`
          ) as unknown as Channel)
        : null;

    const handler = (msg: Message) => {
      const data = msg.data as ScreenshotEvent;
      if (msg.name === "uploaded" || msg.name === "screenshot.uploaded") {
        onUploaded?.(data);
      } else if (msg.name === "screenshot.reviewed") {
        onReviewed?.(data);
      }
    };

    chCompany.subscribe(handler);
    if (chDay) chDay.subscribe(handler);
    if (chPersonal) chPersonal.subscribe(handler);

    return () => {
      chCompany.unsubscribe(handler);
      if (chDay) chDay.unsubscribe(handler);
      if (chPersonal) chPersonal.unsubscribe(handler);
    };
  }, [companyId, workingDay, onUploaded, onReviewed, userId, listenPersonal]);
}
