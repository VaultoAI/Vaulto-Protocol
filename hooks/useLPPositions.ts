"use client";

import { useState, useEffect, useCallback } from "react";
import type { LPPosition, AddLiquidityParams, RemoveLiquidityParams } from "@/lib/lp/types";
import {
  getLPPositions,
  addLiquidity,
  removeLiquidity,
  claimFees,
  getTotalEarnings,
  getTotalLiquidity,
  simulateFeeAccrual,
} from "@/lib/lp/demo-state";

export function useLPPositions() {
  const [positions, setPositions] = useState<LPPosition[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalLiquidity, setTotalLiquidity] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load positions from localStorage
  const refreshPositions = useCallback(() => {
    const currentPositions = getLPPositions();
    setPositions(currentPositions);
    setTotalEarnings(getTotalEarnings());
    setTotalLiquidity(getTotalLiquidity());
  }, []);

  useEffect(() => {
    // Initial load
    refreshPositions();
    setIsLoading(false);

    // Simulate fee accrual every 30 seconds for demo
    const interval = setInterval(() => {
      simulateFeeAccrual();
      refreshPositions();
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshPositions]);

  const handleAddLiquidity = useCallback(
    (params: AddLiquidityParams) => {
      const result = addLiquidity(params);
      refreshPositions();
      return result;
    },
    [refreshPositions]
  );

  const handleRemoveLiquidity = useCallback(
    (params: RemoveLiquidityParams) => {
      const result = removeLiquidity(params);
      refreshPositions();
      return result;
    },
    [refreshPositions]
  );

  const handleClaimFees = useCallback(
    (positionId: string) => {
      const result = claimFees(positionId);
      refreshPositions();
      return result;
    },
    [refreshPositions]
  );

  return {
    positions,
    totalEarnings,
    totalLiquidity,
    isLoading,
    addLiquidity: handleAddLiquidity,
    removeLiquidity: handleRemoveLiquidity,
    claimFees: handleClaimFees,
    refreshPositions,
  };
}
