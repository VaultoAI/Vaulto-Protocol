"use client";

import { useState, useCallback, useEffect } from "react";
import { TokenLogo } from "@/components/TokenLogo";
import { formatUSD } from "@/lib/format";
import type { LPPosition, RemoveLiquidityParams } from "@/lib/lp/types";

type RemoveLiquidityModalProps = {
  isOpen: boolean;
  onClose: () => void;
  position: LPPosition | null;
  onRemoveLiquidity: (params: RemoveLiquidityParams) => void;
};

type ModalState = "idle" | "loading" | "success";

export function RemoveLiquidityModal({
  isOpen,
  onClose,
  position,
  onRemoveLiquidity,
}: RemoveLiquidityModalProps) {
  const [percentToRemove, setPercentToRemove] = useState(100);
  const [claimFees, setClaimFees] = useState(true);
  const [modalState, setModalState] = useState<ModalState>("idle");

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPercentToRemove(100);
      setClaimFees(true);
      setModalState("idle");
    }
  }, [isOpen]);

  const handleQuickPercent = useCallback((percent: number) => {
    setPercentToRemove(percent);
  }, []);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPercentToRemove(parseInt(e.target.value));
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!position) return;

    setModalState("loading");

    // Simulate transaction delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const params: RemoveLiquidityParams = {
      positionId: position.id,
      percentToRemove,
      claimFees,
    };

    onRemoveLiquidity(params);
    setModalState("success");
  }, [position, percentToRemove, claimFees, onRemoveLiquidity]);

  const handleClose = useCallback(() => {
    setPercentToRemove(100);
    setClaimFees(true);
    setModalState("idle");
    onClose();
  }, [onClose]);

  if (!isOpen || !position) return null;

  const tokenToReceive = position.tokenAmount * (percentToRemove / 100);
  const usdcToReceive = position.usdcAmount * (percentToRemove / 100);
  const totalToReceive = tokenToReceive + usdcToReceive;
  const feesToClaim = claimFees ? position.unclaimedFees : 0;

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
          <h2 className="text-lg font-medium">Remove Liquidity</h2>
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
              Liquidity Removed Successfully
            </p>
            <p className="mt-1 text-sm text-green-600 dark:text-green-500">
              You received {formatUSD(totalToReceive + feesToClaim)}
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
            {/* Position Summary */}
            <div className="mt-4 flex items-center gap-3 rounded-md border border-border bg-muted/30 p-3">
              <div className="flex -space-x-1">
                <TokenLogo
                  symbol={position.tokenSymbol}
                  companyName={position.companyName}
                  companyWebsite={position.companyWebsite}
                  size={32}
                  className="ring-2 ring-background"
                />
                <TokenLogo symbol="USDC" size={32} className="ring-2 ring-background" />
              </div>
              <div>
                <p className="font-medium">{position.poolName}</p>
                <p className="text-sm text-muted">
                  Your Liquidity: {formatUSD(position.totalValueUsd)}
                </p>
              </div>
            </div>

            {/* Percentage Slider */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Amount to Remove</label>
                <span className="text-lg font-semibold">{percentToRemove}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={percentToRemove}
                onChange={handleSliderChange}
                disabled={modalState === "loading"}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-foreground disabled:opacity-50"
              />
              <div className="mt-3 flex gap-2">
                {[25, 50, 75, 100].map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    onClick={() => handleQuickPercent(percent)}
                    disabled={modalState === "loading"}
                    className={`flex-1 rounded border px-2 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                      percentToRemove === percent
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {percent}%
                  </button>
                ))}
              </div>
            </div>

            {/* Preview Section */}
            <div className="mt-6 rounded-md border border-border bg-muted/30 p-4">
              <h3 className="text-sm font-medium text-muted mb-3">You Will Receive</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="flex items-center gap-2">
                    <TokenLogo
                      symbol={position.tokenSymbol}
                      companyName={position.companyName}
                      companyWebsite={position.companyWebsite}
                      size={16}
                    />
                    {position.tokenSymbol}
                  </dt>
                  <dd className="font-medium">{tokenToReceive.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="flex items-center gap-2">
                    <TokenLogo symbol="USDC" size={16} />
                    USDC
                  </dt>
                  <dd className="font-medium">{usdcToReceive.toFixed(2)}</dd>
                </div>
                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex justify-between">
                    <dt>Total Value</dt>
                    <dd className="font-medium">{formatUSD(totalToReceive)}</dd>
                  </div>
                </div>
              </dl>
            </div>

            {/* Claim Fees Checkbox */}
            {position.unclaimedFees > 0 && (
              <label className="mt-4 flex items-center gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={claimFees}
                  onChange={(e) => setClaimFees(e.target.checked)}
                  disabled={modalState === "loading"}
                  className="h-4 w-4 rounded border-border"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">Also claim unclaimed fees</p>
                  <p className="text-xs text-green-500">+{formatUSD(position.unclaimedFees)}</p>
                </div>
              </label>
            )}

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={modalState === "loading"}
              className="mt-6 w-full rounded border border-foreground bg-foreground py-3 text-background font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {modalState === "loading" ? "Removing Liquidity..." : "Remove Liquidity"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
