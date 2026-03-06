"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { useSwapConfig } from "@/hooks/useSwapConfig";
import { buildMintParams, getFullRangeTicks } from "@/lib/lp/mint";
import { buildApproveParams, getAllowance, checkAllowance, MAX_APPROVAL } from "@/lib/swap/approval";
import { UNISWAP_ADDRESSES } from "@/lib/uniswap/constants";

import type { PoolOption } from "@/hooks/useSwapConfig";

function parseAmount(value: string, decimals: number): bigint {
  if (!value || !/^\d*\.?\d*$/.test(value)) return BigInt(0);
  const [whole = "0", frac = ""] = value.split(".");
  const combined = whole + frac.slice(0, decimals);
  if (combined === "0" || combined === "") return BigInt(0);
  return BigInt(combined) * BigInt(10) ** BigInt(Math.max(0, decimals - frac.length));
}

export default function AddLiquidityPage() {
  const { address, isConnected, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: config } = useSwapConfig();
  const tokenRegistry = config?.tokens ?? {};
  const poolList = config?.poolList ?? [];
  const isMainnet = chain?.id === 1;

  const [selectedPool, setSelectedPool] = useState<PoolOption | null>(null);
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [error, setError] = useState<string | null>(null);

  const token0Symbol = selectedPool
    ? selectedPool.pool.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean)[0]
    : null;
  const token1Symbol = selectedPool
    ? selectedPool.pool.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean)[1]
    : null;
  const token0Info = token0Symbol ? tokenRegistry[token0Symbol] : null;
  const token1Info = token1Symbol ? tokenRegistry[token1Symbol] : null;

  const amount0Raw = useMemo(
    () => (token0Info ? parseAmount(amount0, token0Info.decimals) : BigInt(0)),
    [amount0, token0Info]
  );
  const amount1Raw = useMemo(
    () => (token1Info ? parseAmount(amount1, token1Info.decimals) : BigInt(0)),
    [amount1, token1Info]
  );

  const { writeContract: writeApprove0, data: approve0Hash } = useWriteContract();
  const { writeContract: writeApprove1, data: approve1Hash } = useWriteContract();
  const { writeContract: writeMint, data: mintHash, isPending: isMintPending } = useWriteContract();

  const { isLoading: approve0Confirming } = useWaitForTransactionReceipt({ hash: approve0Hash });
  const { isLoading: approve1Confirming } = useWaitForTransactionReceipt({ hash: approve1Hash });
  const { isLoading: mintConfirming } = useWaitForTransactionReceipt({ hash: mintHash });

  const [allowance0, setAllowance0] = useState<bigint | null>(null);
  const [allowance1, setAllowance1] = useState<bigint | null>(null);

  const updateAllowances = useCallback(async () => {
    if (!publicClient || !address || !token0Info || !token1Info) return;
    const [a0, a1] = await Promise.all([
      getAllowance(publicClient, {
        owner: address,
        token: token0Info.address as `0x${string}`,
        spender: UNISWAP_ADDRESSES.NonfungiblePositionManager,
      }),
      getAllowance(publicClient, {
        owner: address,
        token: token1Info.address as `0x${string}`,
        spender: UNISWAP_ADDRESSES.NonfungiblePositionManager,
      }),
    ]);
    setAllowance0(a0);
    setAllowance1(a1);
  }, [publicClient, address, token0Info?.address, token1Info?.address]);

  useQuery({
    queryKey: ["allowances-npm", address, token0Info?.address, token1Info?.address],
    queryFn: updateAllowances,
    enabled: Boolean(publicClient && address && token0Info && token1Info),
  });

  const needsApprove0 =
    token0Info && allowance0 != null && !checkAllowance(allowance0, amount0Raw).sufficient;
  const needsApprove1 =
    token1Info && allowance1 != null && !checkAllowance(allowance1, amount1Raw).sufficient;
  const canMint =
    isConnected &&
    isMainnet &&
    address &&
    selectedPool &&
    token0Info &&
    token1Info &&
    amount0Raw > BigInt(0) &&
    amount1Raw > BigInt(0) &&
    !needsApprove0 &&
    !needsApprove1;

  const doApprove0 = useCallback(() => {
    if (!token0Info) return;
    setError(null);
    writeApprove0(
      buildApproveParams({
        token: token0Info.address as `0x${string}`,
        spender: UNISWAP_ADDRESSES.NonfungiblePositionManager,
        amount: MAX_APPROVAL,
      })
    );
  }, [token0Info, writeApprove0]);
  const doApprove1 = useCallback(() => {
    if (!token1Info) return;
    setError(null);
    writeApprove1(
      buildApproveParams({
        token: token1Info.address as `0x${string}`,
        spender: UNISWAP_ADDRESSES.NonfungiblePositionManager,
        amount: MAX_APPROVAL,
      })
    );
  }, [token1Info, writeApprove1]);

  const doMint = useCallback(() => {
    if (!canMint || !address || !selectedPool || !token0Info || !token1Info) return;
    setError(null);
    const { tickLower, tickUpper } = getFullRangeTicks(selectedPool.feeTier);
    const params = buildMintParams({
      token0: token0Info.address as `0x${string}`,
      token1: token1Info.address as `0x${string}`,
      fee: selectedPool.feeTier,
      tickLower,
      tickUpper,
      amount0Desired: amount0Raw,
      amount1Desired: amount1Raw,
      recipient: address,
    });
    writeMint(params);
  }, [
    canMint,
    address,
    selectedPool,
    token0Info,
    token1Info,
    amount0Raw,
    amount1Raw,
    writeMint,
  ]);

  const isBusy = approve0Confirming || approve1Confirming || isMintPending || mintConfirming;

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-medium tracking-tight">Add liquidity</h1>
      <p className="mt-2 text-muted">Create a new Uniswap V3 position (full range).</p>
      <div className="mt-6">
        <Link href="/earn" className="text-sm text-muted hover:underline">
          ← Back to Earn
        </Link>
      </div>

      {!isConnected && (
        <p className="mt-6 rounded-lg border border-border bg-background p-4 text-sm text-muted">
          Connect your wallet to add liquidity.
        </p>
      )}

      {isConnected && !isMainnet && (
        <p className="mt-6 rounded-lg border border-border bg-background p-4 text-sm text-muted">
          Switch to Ethereum mainnet to add liquidity.
        </p>
      )}

      {isConnected && isMainnet && (
        <div className="mt-8 space-y-6 rounded-lg border border-border bg-background p-6">
          <div>
            <label className="block text-sm font-medium text-muted">Pool</label>
            <select
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-foreground"
              value={selectedPool?.pool ?? ""}
              onChange={(e) => {
                const p = poolList.find((x) => x.pool === e.target.value) ?? null;
                setSelectedPool(p);
              }}
            >
              <option value="">Select pool</option>
              {poolList.map((p) => (
                <option key={p.address} value={p.pool}>
                  {p.pool}
                </option>
              ))}
            </select>
          </div>

          {selectedPool && token0Symbol && token1Symbol && (
            <>
              <div>
                <label className="block text-sm font-medium text-muted">
                  Amount {token0Symbol}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount0}
                  onChange={(e) => setAmount0(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted">
                  Amount {token1Symbol}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={amount1}
                  onChange={(e) => setAmount1(e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-foreground"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          {selectedPool && amount0Raw > BigInt(0) && amount1Raw > BigInt(0) && (
            <div className="flex flex-col gap-2">
              {needsApprove0 && (
                <button
                  type="button"
                  onClick={doApprove0}
                  disabled={isBusy}
                  className="w-full rounded border border-foreground bg-foreground py-3 text-background font-medium hover:opacity-90 disabled:opacity-50"
                >
                  Approve {token0Symbol}
                </button>
              )}
              {needsApprove1 && (
                <button
                  type="button"
                  onClick={doApprove1}
                  disabled={isBusy}
                  className="w-full rounded border border-foreground bg-foreground py-3 text-background font-medium hover:opacity-90 disabled:opacity-50"
                >
                  Approve {token1Symbol}
                </button>
              )}
              <button
                type="button"
                onClick={doMint}
                disabled={!canMint || isBusy}
                className="w-full rounded border border-foreground bg-foreground py-3 text-background font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMintPending || mintConfirming ? "Adding liquidity…" : "Add liquidity"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
