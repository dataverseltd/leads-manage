"use client";

import { useEffect } from "react";
import Ably from "ably";

export type ScreenshotEvent = {
  _id: string;
  productName: string;
  workingDay: string;
  companyId: string | null;
  uploadedBy: string | null;
  reviewed?: boolean;
};

type Params = {
  companyIds: string[];
  workingDay?: string;
  onUploaded?: (e: ScreenshotEvent) => void;
  onReviewed?: (e: ScreenshotEvent) => void;
};

/** Minimal channel surface we actually use (keeps us independent of Ably’s changing d.ts) */
type MinimalMessage = { data: unknown };
type MinimalChannel = {
  subscribe: (name: string, listener: (msg: MinimalMessage) => void) => void;
  unsubscribe: (name: string, listener: (msg: MinimalMessage) => void) => void;
  detach?: () => void;
};

export function useMultiCompanyScreenshotRT({
  companyIds,
  workingDay,
  onUploaded,
  onReviewed,
}: Params) {
  useEffect(() => {
    if (!companyIds || companyIds.length === 0) return;

    // Use Ably.Realtime at runtime, avoid importing SDK types
    const client = new Ably.Realtime({
      authUrl: `/api/ably/token?companyId=${encodeURIComponent(companyIds[0])}`,
    });

    const cleanups: Array<() => void> = [];
    const channels: MinimalChannel[] = [];

    // helper: subscribe to one channel safely
    const sub = <T>(
      ch: MinimalChannel,
      name: string,
      handler: (data: T) => void
    ) => {
      const cb = (msg: MinimalMessage) => handler(msg.data as T);
      ch.subscribe(name, cb);
      cleanups.push(() => {
        try {
          ch.unsubscribe(name, cb);
        } catch {
          /* ignore */
        }
      });
    };

    // attach channels for each company
    for (const cid of companyIds) {
      const chAll = client.channels.get(
        `companies.${cid}.screenshots`
      ) as unknown as MinimalChannel;

      channels.push(chAll);

      sub<ScreenshotEvent>(chAll, "uploaded", (d) => {
        if (!workingDay || d?.workingDay === workingDay) onUploaded?.(d);
      });

      sub<ScreenshotEvent>(chAll, "screenshot.reviewed", (d) => {
        if (!workingDay || d?.workingDay === workingDay) onReviewed?.(d);
      });

      if (workingDay) {
        const chDay = client.channels.get(
          `companies.${cid}.screenshots.${workingDay}`
        ) as unknown as MinimalChannel;

        channels.push(chDay);

        sub<ScreenshotEvent>(chDay, "uploaded", (d) => onUploaded?.(d));
        sub<ScreenshotEvent>(chDay, "screenshot.reviewed", (d) =>
          onReviewed?.(d)
        );
      }
    }

    return () => {
      try {
        cleanups.forEach((fn) => fn());
        channels.forEach((c) => c.detach?.());
        client.close();
      } catch {
        /* ignore */
      }
    };
  }, [companyIds, workingDay, onUploaded, onReviewed]);
}
