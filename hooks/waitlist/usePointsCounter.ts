"use client";

import { useMemo } from "react";
import { useTick } from "./useTickContext";

export function usePointsCounter(createdAt: Date | string, bonusPoints: number): number {
  const tick = useTick();

  const points = useMemo(() => {
    const createdAtDate = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
    const now = new Date();
    const timeBasedPoints = Math.floor((now.getTime() - createdAtDate.getTime()) / 333);
    return timeBasedPoints + bonusPoints;
  }, [createdAt, bonusPoints, tick]);

  return points;
}
