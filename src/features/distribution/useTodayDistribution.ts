// src/features/distribution/useTodayDistribution.ts
"use client";

import { useEffect, useState } from "react";

type Receiver = {
  _id: string;
  name: string;
  employeeId?: string;
  canReceiveLeads?: boolean;
  lastAssignedAt?: string;
  dailyCap?: number;
  weight?: number;
  role?: string;
};

type AssignedRow = {
  receiverId: string;
  name: string;
  employeeId: string;
  count: number;
};

type TodayPayload = {
  workingDay: string;
  switch?: {
    isActive: boolean;
    activatedAt?: string | null;
    updatedAt?: string | null;
  } | null;
  metrics?: {
    pendingToday: number;
    assignedTodayByReceiver: AssignedRow[];
  } | null;
  receivers?: Receiver[];
};

export function useTodayDistribution() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingDay, setWorkingDay] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(false);
  const [activatedAt, setActivatedAt] = useState<string | null>(null);
  const [pendingToday, setPendingToday] = useState<number>(0);
  const [assignedTodayByReceiver, setAssignedTodayByReceiver] = useState<
    AssignedRow[]
  >([]);
  const [receivers, setReceivers] = useState<Receiver[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/admin/distribution/today", {
          cache: "no-store",
        });
        const data = (await res.json()) as Partial<TodayPayload> & {
          error?: string;
        };

        if (!res.ok) throw new Error(data?.error || "Failed to load");

        if (!alive) return;

        setWorkingDay(data.workingDay ?? "");
        setIsActive(Boolean(data.switch?.isActive));
        setActivatedAt(data.switch?.activatedAt ?? null);
        setPendingToday(Number(data.metrics?.pendingToday ?? 0));
        setAssignedTodayByReceiver(data.metrics?.assignedTodayByReceiver ?? []);
        setReceivers(data.receivers ?? []);
        setError(null);
      } catch (e: unknown) {
        if (!alive) return;
        const msg = e instanceof Error ? e.message : "Failed to load";
        setError(msg);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return {
    loading,
    error,
    workingDay,
    isActive,
    activatedAt,
    pendingToday,
    assignedTodayByReceiver,
    receivers,
  };
}
