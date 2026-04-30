"use client";

import { useState, useEffect, useCallback } from "react";
import { useSendTransaction } from "@privy-io/react-auth";
import { useWaitForTransactionReceipt } from "wagmi";
import { decodeFunctionData } from "viem";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { X, Check, ExternalLink, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { ERC20_ABI } from "@/lib/trading-wallet/constants";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type WithdrawStep = "input" | "returning_safe" | "mfa" | "signing" | "confirming" | "success";

export function WithdrawModal({ isOpen, onClose }: WithdrawModalProps) {
  const [amount, setAmount] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [step, setStep] = useState<WithdrawStep>("input");
  const [error, setError] = useState<string | null>(null);
  const [withdrawalId, setWithdrawalId] = useState<string | null>(null);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [isSending, setIsSending] = useState(false);

  const {
    balance,
    polymarketBalance,
    totalAvailable,
    requestWithdrawal,
    executeWithdrawal,
    returnSafeFunds,
    isRequestingWithdrawal,
    isExecutingWithdrawal,
    isReturningSafeFunds,
    externalWallet,
    embeddedWallet,
    invalidateAll,
    refetchBalance,
  } = useTradingWallet();

  // Use Privy's sendTransaction to sign from embedded wallet
  const { sendTransaction } = useSendTransaction();

  // Wait for transaction receipt (wagmi works with any txHash)
  const {
    isLoading: isConfirmingTx,
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleSetMax = () => {
    // Use total available (proxy + polymarket) for max withdrawal
    setAmount(totalAvailable);
  };

  // Check if there are funds in the Polymarket Safe wallet
  const hasSafeFunds = parseFloat(polymarketBalance) > 0;

  const handleUseConnectedWallet = () => {
    if (externalWallet?.address) {
      setToAddress(externalWallet.address);
    }
  };

  // Handle transaction confirmation with backend
  const handleConfirmation = useCallback(async () => {
    if (txHash && isConfirmed && withdrawalId && step === "confirming") {
      console.log("[WithdrawModal] Transaction confirmed, updating backend...");
      try {
        const confirmRes = await fetch("/api/trading-wallet/withdraw/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ withdrawalId, txHash }),
        });

        const confirmResult = await confirmRes.json();
        console.log("[WithdrawModal] Backend confirm result:", confirmResult);

        if (!confirmRes.ok || !confirmResult.success) {
          throw new Error(confirmResult.error || confirmResult.message || "Failed to confirm withdrawal");
        }

        setStep("success");
        invalidateAll();
      } catch (err) {
        console.error("[WithdrawModal] Confirmation error:", err);
        setError(err instanceof Error ? err.message : "Failed to confirm withdrawal");
        setStep("input");
      }
    }
  }, [txHash, isConfirmed, withdrawalId, step, invalidateAll]);

  // Trigger confirmation when tx is confirmed
  useEffect(() => {
    handleConfirmation();
  }, [handleConfirmation]);

  // Handle receipt errors
  useEffect(() => {
    if (receiptError) {
      console.error("[WithdrawModal] Receipt error:", receiptError);
      setError("Transaction failed on-chain");
      setStep("input");
    }
  }, [receiptError]);

  const handleWithdraw = async () => {
    const LOG = "[WithdrawModal]";

    // Validate inputs
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!toAddress || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      setError("Please enter a valid destination address");
      return;
    }

    setError(null);
    setTxHash(undefined);

    const amountNum = parseFloat(amount);
    const proxyBalanceNum = parseFloat(balance);
    const polymarketBalanceNum = parseFloat(polymarketBalance);

    // Check if we need funds from the Safe wallet
    const needsSafeFunds = amountNum > proxyBalanceNum && polymarketBalanceNum > 0;

    try {
      console.log(`${LOG} Starting withdrawal flow`);
      console.log(`${LOG} Amount: ${amount}, To: ${toAddress}`);
      console.log(`${LOG} Proxy balance: ${proxyBalanceNum}, Polymarket balance: ${polymarketBalanceNum}`);
      console.log(`${LOG} Needs Safe funds: ${needsSafeFunds}`);

      // Step 0: Return funds from Safe wallet if needed
      if (needsSafeFunds) {
        console.log(`${LOG} Step 0: Returning funds from Safe wallet...`);
        setStep("returning_safe");

        try {
          const safeFundsResult = await returnSafeFunds();
          console.log(`${LOG} Safe funds result:`, safeFundsResult);

          if (!safeFundsResult.success && !safeFundsResult.skipped) {
            throw new Error(safeFundsResult.error || "Failed to return funds from Polymarket wallet");
          }

          // Refresh balance after returning Safe funds
          await refetchBalance();

          // Small delay to ensure balance is updated
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (safeFundsError) {
          console.error(`${LOG} Safe funds error:`, safeFundsError);
          // Continue anyway - the withdrawal might still work with available balance
          console.log(`${LOG} Continuing with available proxy balance...`);
        }
      }

      // Step 1: Request withdrawal from API
      console.log(`${LOG} Step 1: Requesting withdrawal...`);
      setStep("input"); // Reset to input temporarily for better UX

      const requestResult = await requestWithdrawal({
        amount,
        toAddress,
      });
      console.log(`${LOG} Request result:`, requestResult);

      setWithdrawalId(requestResult.id);
      setRequiresMfa(requestResult.requiresMfa);

      // If MFA is required, go to MFA step
      if (requestResult.requiresMfa) {
        console.log(`${LOG} MFA required, stopping`);
        setStep("mfa");
        return;
      }

      // Step 2: Get transaction data
      console.log(`${LOG} Step 2: Getting transaction data...`);
      const executeResult = await executeWithdrawal(requestResult.id);
      console.log(`${LOG} Execute result:`, executeResult);

      // Handle server-side signing (SUBMITTED status)
      if (executeResult.status === "SUBMITTED" && executeResult.txHash) {
        // Server already signed and submitted the transaction
        console.log(`${LOG} Server signed and submitted, txHash:`, executeResult.txHash);
        setTxHash(executeResult.txHash as `0x${string}`);
        setStep("success");
        invalidateAll();
        return;
      }

      if (executeResult.status === "READY_TO_SIGN" && executeResult.txData) {
        // Client-side signing (legacy wallets without server signer)
        if (!embeddedWallet?.address) {
          throw new Error("Trading wallet not available");
        }

        console.log(`${LOG} Step 3: Sending transaction via Privy (embedded wallet)...`);
        console.log(`${LOG} txData.to (USDC contract):`, executeResult.txData.to);
        console.log(`${LOG} txData.data (encoded transfer):`, executeResult.txData.data);
        console.log(`${LOG} Embedded wallet address:`, embeddedWallet.address);

        // Decode and verify the transfer amount
        try {
          const decoded = decodeFunctionData({
            abi: ERC20_ABI,
            data: executeResult.txData.data as `0x${string}`,
          });
          console.log(`${LOG} Decoded function:`, decoded.functionName);
          if (decoded.functionName === "transfer" && decoded.args) {
            const [toAddr, rawAmount] = decoded.args as [string, bigint];
            const usdcAmount = Number(rawAmount) / 1_000_000;
            console.log(`${LOG} Decoded transfer to:`, toAddr);
            console.log(`${LOG} Decoded raw amount:`, rawAmount.toString());
            console.log(`${LOG} Decoded USDC amount:`, usdcAmount);
          }
        } catch (decodeErr) {
          console.error(`${LOG} Failed to decode txData:`, decodeErr);
        }

        setStep("signing");
        setIsSending(true);

        try {
          // Sign from embedded wallet using Privy's sendTransaction
          const receipt = await sendTransaction(
            {
              to: executeResult.txData.to as `0x${string}`,
              data: executeResult.txData.data as `0x${string}`,
              chainId: 137, // Polygon
            },
            {
              address: embeddedWallet.address,
            }
          );

          console.log(`${LOG} Transaction sent, txHash:`, receipt.hash);
          setTxHash(receipt.hash);
          setStep("confirming");
        } catch (sendErr) {
          console.error(`${LOG} Send error:`, sendErr);
          const errorMessage = sendErr instanceof Error ? sendErr.message : "Transaction failed";
          if (errorMessage.toLowerCase().includes("reject") || errorMessage.toLowerCase().includes("denied")) {
            setError("Transaction rejected by user");
          } else {
            setError(errorMessage);
          }
          setStep("input");
        } finally {
          setIsSending(false);
        }
        return;
      } else if (executeResult.status === "COMPLETED" && executeResult.txHash) {
        // Already completed
        console.log(`${LOG} Already completed with txHash:`, executeResult.txHash);
        setStep("success");
        invalidateAll();
      } else if (executeResult.status === "FAILED") {
        // Server signing failed
        console.error(`${LOG} Server signing failed:`, executeResult.message);
        throw new Error(executeResult.message || "Transaction failed");
      } else {
        console.error(`${LOG} Unexpected response:`, executeResult);
        throw new Error(`Unexpected response: status=${executeResult.status}`);
      }
    } catch (err) {
      console.error(`${LOG} Error:`, err);
      const errorMessage = err instanceof Error ? err.message : "Failed to process withdrawal";
      setError(errorMessage);
      setStep("input");
    }
  };

  const handleClose = () => {
    setAmount("");
    setToAddress("");
    setStep("input");
    setError(null);
    setWithdrawalId(null);
    setRequiresMfa(false);
    setTxHash(undefined);
    setIsSending(false);
    onClose();
  };

  const isProcessing = isRequestingWithdrawal || isExecutingWithdrawal || isSending || isConfirmingTx || isReturningSafeFunds;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Withdraw USDC
          </h2>
          <button
            onClick={handleClose}
            className="rounded-full p-1 hover:bg-foreground/10 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-muted" />
          </button>
        </div>

        {step === "input" && (
          <>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">
                    Amount (USDC)
                  </label>
                  <button
                    onClick={handleSetMax}
                    className="text-xs text-muted hover:text-foreground transition-colors"
                  >
                    Max: ${parseFloat(totalAvailable).toFixed(2)}
                  </button>
                </div>
                <div className="flex items-center rounded-lg border border-border">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="flex-1 bg-transparent px-3 py-2.5 text-foreground placeholder:text-muted focus:outline-none"
                  />
                  <span className="px-3 text-sm font-medium text-muted">
                    USDC
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">
                    Destination Address
                  </label>
                  {externalWallet && (
                    <button
                      onClick={handleUseConnectedWallet}
                      className="text-xs text-muted hover:text-foreground transition-colors"
                    >
                      Use connected wallet
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="0x..."
                  value={toAddress}
                  onChange={(e) => setToAddress(e.target.value)}
                  className="w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-foreground font-mono text-sm placeholder:text-muted focus:outline-none"
                />
              </div>

              {/* Balance breakdown when there are Polymarket funds */}
              {hasSafeFunds && (
                <div className="rounded-lg border border-border bg-foreground/5 p-3">
                  <p className="text-xs font-medium text-muted mb-2">Balance Breakdown</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Trading Wallet</span>
                      <span className="text-foreground">${parseFloat(balance).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Polymarket Wallet</span>
                      <span className="text-foreground">${parseFloat(polymarketBalance).toFixed(2)}</span>
                    </div>
                    <div className="border-t border-border my-1.5" />
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className="text-foreground">Total Available</span>
                      <span className="text-foreground">${parseFloat(totalAvailable).toFixed(2)}</span>
                    </div>
                  </div>
                  {parseFloat(amount) > parseFloat(balance) && parseFloat(amount) <= parseFloat(totalAvailable) && (
                    <p className="text-xs text-muted mt-2 flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" />
                      Polymarket funds will be transferred first
                    </p>
                  )}
                </div>
              )}
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={
                  !amount ||
                  parseFloat(amount) <= 0 ||
                  !toAddress ||
                  isProcessing
                }
                className="flex-1 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Withdraw"
                )}
              </button>
            </div>
          </>
        )}

        {step === "returning_safe" && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-foreground/20 border-t-foreground" />
            <h3 className="text-lg font-medium text-foreground">
              Consolidating Funds
            </h3>
            <p className="mt-2 text-sm text-muted">
              Transferring funds from Polymarket wallet...
            </p>
            <p className="mt-1 text-xs text-muted">
              This may take a moment
            </p>
          </div>
        )}

        {step === "mfa" && (
          <div className="py-4">
            <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
              <div className="text-sm">
                <p className="font-medium text-yellow-700 dark:text-yellow-300">
                  Additional Verification Required
                </p>
                <p className="mt-0.5 text-yellow-600 dark:text-yellow-400">
                  This withdrawal amount requires MFA verification.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted text-center">
              MFA verification coming soon. Contact support for large withdrawals.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {step === "signing" && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-foreground/20 border-t-foreground" />
            <h3 className="text-lg font-medium text-foreground">
              Confirm in Wallet
            </h3>
            <p className="mt-2 text-sm text-muted">
              Please confirm the transaction in your wallet...
            </p>
          </div>
        )}

        {step === "confirming" && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-foreground/20 border-t-foreground" />
            <h3 className="text-lg font-medium text-foreground">
              Confirming Transaction
            </h3>
            <p className="mt-2 text-sm text-muted">
              Waiting for blockchain confirmation...
            </p>
            {txHash && (
              <a
                href={`https://polygonscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
              >
                View on PolygonScan
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {step === "success" && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <Check className="h-6 w-6 text-green-500" />
            </div>
            <h3 className="text-lg font-medium text-foreground">
              Withdrawal Successful
            </h3>
            <p className="mt-2 text-sm text-muted">
              ${amount} USDC has been sent to your wallet
            </p>
            {txHash && (
              <a
                href={`https://polygonscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-foreground hover:underline"
              >
                View on PolygonScan
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              onClick={handleClose}
              className="mt-6 w-full rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
