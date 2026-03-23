"use client";

import { useState, useCallback, useEffect } from "react";
import { TokenLogo } from "@/components/TokenLogo";
import { formatUSD, formatPercent } from "@/lib/format";
import type { StockPool } from "@/components/EarnPoolsTable";
import type { AddLiquidityParams } from "@/lib/lp/types";

type AddLiquidityModalProps = {
  isOpen: boolean;
  onClose: () => void;
  pool: StockPool | null;
  pools: StockPool[];
  onAddLiquidity: (params: AddLiquidityParams) => void;
};

type ModalState = "idle" | "loading" | "success";

export function AddLiquidityModal({
  isOpen,
  onClose,
  pool: initialPool,
  pools,
  onAddLiquidity,
}: AddLiquidityModalProps) {
  const [selectedPool, setSelectedPool] = useState<StockPool | null>(initialPool);
  const [tokenAmount, setTokenAmount] = useState("");
  const [usdcAmount, setUsdcAmount] = useState("");
  const [modalState, setModalState] = useState<ModalState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Demo balance (in reality this would come from wallet)
  const demoUsdcBalance = 10000;

  // Update selected pool when initialPool changes
  useEffect(() => {
    if (initialPool) {
      setSelectedPool(initialPool);
    }
  }, [initialPool]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTokenAmount("");
      setUsdcAmount("");
      setModalState("idle");
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleTokenAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (/^\d*\.?\d*$/.test(value)) {
        setTokenAmount(value);
        // Auto-calculate USDC (1:1 for demo)
        if (value) {
          setUsdcAmount(value);
        } else {
          setUsdcAmount("");
        }
        setErrorMessage(null);
      }
    },
    []
  );

  const handleUsdcAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (/^\d*\.?\d*$/.test(value)) {
        setUsdcAmount(value);
        // Auto-calculate token (1:1 for demo)
        if (value) {
          setTokenAmount(value);
        } else {
          setTokenAmount("");
        }
        setErrorMessage(null);
      }
    },
    []
  );

  const handleMaxUsdc = useCallback(() => {
    const maxAmount = (demoUsdcBalance / 2).toString();
    setUsdcAmount(maxAmount);
    setTokenAmount(maxAmount);
    setErrorMessage(null);
  }, []);

  const handleHalfUsdc = useCallback(() => {
    const halfAmount = (demoUsdcBalance / 4).toString();
    setUsdcAmount(halfAmount);
    setTokenAmount(halfAmount);
    setErrorMessage(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedPool) {
      setErrorMessage("Please select a pool");
      return;
    }

    const tokenVal = parseFloat(tokenAmount);
    const usdcVal = parseFloat(usdcAmount);

    if (!tokenVal || !usdcVal || tokenVal <= 0 || usdcVal <= 0) {
      setErrorMessage("Please enter valid amounts");
      return;
    }

    if (usdcVal > demoUsdcBalance) {
      setErrorMessage("Insufficient USDC balance");
      return;
    }

    setModalState("loading");
    setErrorMessage(null);

    // Simulate transaction delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const params: AddLiquidityParams = {
      poolId: `pool-${selectedPool.company.id}`,
      poolName: selectedPool.poolName,
      tokenSymbol: selectedPool.symbol,
      companyId: selectedPool.company.id,
      companyName: selectedPool.company.name,
      companyWebsite: selectedPool.company.website,
      tokenAmount: tokenVal,
      usdcAmount: usdcVal,
      apr: selectedPool.apr,
      poolTvl: selectedPool.tvlUSD,
    };

    onAddLiquidity(params);
    setModalState("success");
  }, [selectedPool, tokenAmount, usdcAmount, onAddLiquidity]);

  const handleClose = useCallback(() => {
    setSelectedPool(null);
    setTokenAmount("");
    setUsdcAmount("");
    setModalState("idle");
    setErrorMessage(null);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const tokenVal = parseFloat(tokenAmount) || 0;
  const usdcVal = parseFloat(usdcAmount) || 0;
  const totalValue = tokenVal + usdcVal;

  // Calculate pool share preview
  const newTvl = selectedPool ? selectedPool.tvlUSD + totalValue : totalValue;
  const sharePercent = newTvl > 0 ? (totalValue / newTvl) * 100 : 0;

  // Estimated daily fees based on APR
  const dailyFeesEstimate = selectedPool
    ? (totalValue * (selectedPool.apr / 100)) / 365
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Add Liquidity</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted hover:text-foreground"
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {modalState === "success" ? (
          <div className="mt-6 rounded-md bg-green-50 dark:bg-green-900/20 p-4 text-center">
            <svg
              className="mx-auto h-10 w-10 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <p className="mt-2 font-medium text-green-700 dark:text-green-400">
              Liquidity Added Successfully
            </p>
            <p className="mt-1 text-sm text-green-600 dark:text-green-500">
              You added {formatUSD(totalValue)} to {selectedPool?.poolName}
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-4 w-full rounded border border-foreground bg-foreground py-2 text-background font-medium hover:opacity-90"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Pool Selector (if no initial pool) */}
            {!initialPool && (
              <div className="mt-4">
                <label className="block text-sm font-medium">Select Pool</label>
                <div className="relative mt-1">
                  <select
                    value={selectedPool?.company.id || ""}
                    onChange={(e) => {
                      const pool = pools.find(
                        (p) => p.company.id === parseInt(e.target.value)
                      );
                      setSelectedPool(pool || null);
                    }}
                    className="appearance-none w-full rounded-lg border border-border/50 bg-card-bg px-4 py-3 pr-10 text-foreground transition-all hover:border-border focus:outline-none focus:ring-2 focus:ring-green/20 focus:border-green/50 cursor-pointer"
                  >
                    <option value="">Choose a pool...</option>
                    {pools.map((pool) => (
                      <option key={pool.company.id} value={pool.company.id}>
                        {pool.poolName} - {formatPercent(pool.apr)} APR
                      </option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}

            {/* Pool Info Header */}
            {selectedPool && (
              <div className="mt-4 flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="flex -space-x-1">
                  <TokenLogo
                    symbol={selectedPool.symbol}
                    companyName={selectedPool.company.name}
                    companyWebsite={selectedPool.company.website}
                    size={32}
                    className="ring-2 ring-background"
                  />
                  <TokenLogo symbol="USDC" size={32} className="ring-2 ring-background" />
                </div>
                <div>
                  <p className="font-medium">{selectedPool.poolName}</p>
                  <p className="text-sm text-muted">
                    {formatPercent(selectedPool.apr)} APR
                  </p>
                </div>
              </div>
            )}

            {/* Token Input */}
            <div className="mt-4">
              <label className="block text-sm font-medium">
                {selectedPool?.symbol || "Token"} Amount
              </label>
              <div className="mt-1 relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={tokenAmount}
                  onChange={handleTokenAmountChange}
                  disabled={modalState === "loading" || !selectedPool}
                  className="w-full rounded border border-border bg-background px-4 py-3 pr-20 text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-border disabled:opacity-50"
                />
                {selectedPool && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <TokenLogo
                      symbol={selectedPool.symbol}
                      companyName={selectedPool.company.name}
                      companyWebsite={selectedPool.company.website}
                      size={20}
                    />
                    <span className="text-sm text-muted">{selectedPool.symbol}</span>
                  </div>
                )}
              </div>
            </div>

            {/* USDC Input */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">USDC Amount</label>
                <span className="text-xs text-muted">
                  Balance: {formatUSD(demoUsdcBalance)}
                </span>
              </div>
              <div className="mt-1 relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={usdcAmount}
                  onChange={handleUsdcAmountChange}
                  disabled={modalState === "loading" || !selectedPool}
                  className="w-full rounded border border-border bg-background px-4 py-3 pr-20 text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-border disabled:opacity-50"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <TokenLogo symbol="USDC" size={20} />
                  <span className="text-sm text-muted">USDC</span>
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleHalfUsdc}
                  disabled={modalState === "loading" || !selectedPool}
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-muted/50 disabled:opacity-50"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={handleMaxUsdc}
                  disabled={modalState === "loading" || !selectedPool}
                  className="rounded border border-border px-2 py-1 text-xs hover:bg-muted/50 disabled:opacity-50"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Pool Info Section */}
            {selectedPool && totalValue > 0 && (
              <div className="mt-4 rounded-md border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-medium text-muted mb-3">Position Preview</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Pool TVL</dt>
                    <dd>{formatUSD(selectedPool.tvlUSD)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Your Deposit</dt>
                    <dd className="font-medium">{formatUSD(totalValue)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Pool Share</dt>
                    <dd className="font-medium">{sharePercent.toFixed(4)}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Est. Daily Fees</dt>
                    <dd className="text-green-500 font-medium">{formatUSD(dailyFeesEstimate)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Fee Tier</dt>
                    <dd>0.3%</dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <p
                className="mt-4 text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {errorMessage}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                modalState === "loading" ||
                !selectedPool ||
                !tokenAmount ||
                !usdcAmount ||
                parseFloat(tokenAmount) <= 0 ||
                parseFloat(usdcAmount) <= 0
              }
              className="mt-6 w-full rounded border border-foreground bg-foreground py-3 text-background font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {modalState === "loading" ? "Adding Liquidity..." : "Add Liquidity"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
