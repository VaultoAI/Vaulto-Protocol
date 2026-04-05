"use client";

import { useState, useEffect, useCallback } from "react";
import { useSendTransaction } from "@privy-io/react-auth";
import { useWaitForTransactionReceipt } from "wagmi";
import { decodeFunctionData } from "viem";
import { useTradingWallet } from "@/hooks/useTradingWallet";
import { Check, ExternalLink, AlertTriangle, Loader2 } from "lucide-react";
import { ERC20_ABI } from "@/lib/trading-wallet/constants";

type WithdrawStep = "input" | "mfa" | "signing" | "confirming" | "success";

export function WithdrawInline() {
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
    requestWithdrawal,
    executeWithdrawal,
    isRequestingWithdrawal,
    isExecutingWithdrawal,
    externalWallet,
    embeddedWallet,
    invalidateAll,
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
    setAmount(balance);
  };

  const handleUseConnectedWallet = () => {
    if (externalWallet?.address) {
      setToAddress(externalWallet.address);
    }
  };

  // Handle transaction confirmation with backend
  const handleConfirmation = useCallback(async () => {
    if (txHash && isConfirmed && withdrawalId && step === "confirming") {
      console.log("[WithdrawInline] Transaction confirmed, updating backend...");
      try {
        const confirmRes = await fetch("/api/trading-wallet/withdraw/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ withdrawalId, txHash }),
        });

        const confirmResult = await confirmRes.json();
        console.log("[WithdrawInline] Backend confirm result:", confirmResult);

        if (!confirmRes.ok || !confirmResult.success) {
          throw new Error(confirmResult.error || confirmResult.message || "Failed to confirm withdrawal");
        }

        setStep("success");
        invalidateAll();
      } catch (err) {
        console.error("[WithdrawInline] Confirmation error:", err);
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
      console.error("[WithdrawInline] Receipt error:", receiptError);
      setError("Transaction failed on-chain");
      setStep("input");
    }
  }, [receiptError]);

  const handleWithdraw = async () => {
    const LOG = "[WithdrawInline]";

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

    try {
      console.log(`${LOG} Starting withdrawal flow`);
      console.log(`${LOG} Amount: ${amount}, To: ${toAddress}`);

      // Step 1: Request withdrawal from API
      console.log(`${LOG} Step 1: Requesting withdrawal...`);
      console.log(`${LOG} User-entered amount:`, amount, `(type: ${typeof amount})`);
      console.log(`${LOG} User-entered toAddress:`, toAddress);
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

      if (executeResult.status === "READY_TO_SIGN" && executeResult.txData) {
        if (!embeddedWallet?.address) {
          throw new Error("Trading wallet not available");
        }

        console.log(`${LOG} Step 3: Sending transaction via Privy (embedded wallet)...`);
        console.log(`${LOG} txData.to (USDC contract):`, executeResult.txData.to);
        console.log(`${LOG} txData.data (encoded transfer):`, executeResult.txData.data);
        console.log(`${LOG} txData.chainId:`, executeResult.txData.chainId);
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

  const handleReset = () => {
    setAmount("");
    setToAddress("");
    setStep("input");
    setError(null);
    setWithdrawalId(null);
    setRequiresMfa(false);
    setTxHash(undefined);
    setIsSending(false);
  };

  const isWithdrawDisabled = parseFloat(balance) <= 0;
  const isProcessing = isRequestingWithdrawal || isExecutingWithdrawal || isSending || isConfirmingTx;

  // Input Step
  if (step === "input") {
    return (
      <div>
        <h3 className="text-sm font-medium text-foreground mb-4">Withdraw Funds</h3>

        <div className="space-y-4">
          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-muted">Amount</label>
              <button
                onClick={handleSetMax}
                disabled={isWithdrawDisabled}
                className="text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                Available: ${parseFloat(balance).toFixed(2)}
              </button>
            </div>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                disabled={isWithdrawDisabled}
                className="w-full rounded-lg border border-border bg-transparent py-3 pl-3 pr-16 text-lg text-foreground placeholder:text-muted focus:outline-none focus:border-foreground/50 disabled:opacity-50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">USDC</span>
            </div>
          </div>

          {/* Destination Address */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-muted">Destination Address</label>
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
              onChange={(e) => {
                setToAddress(e.target.value);
                setError(null);
              }}
              disabled={isWithdrawDisabled}
              className="w-full rounded-lg border border-border bg-transparent px-3 py-3 text-foreground font-mono text-sm placeholder:text-muted focus:outline-none focus:border-foreground/50 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Withdraw Button */}
        <button
          onClick={handleWithdraw}
          disabled={
            !amount ||
            parseFloat(amount) <= 0 ||
            !toAddress ||
            isProcessing ||
            isWithdrawDisabled
          }
          className="mt-4 w-full rounded-lg bg-foreground py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
    );
  }

  // MFA Step
  if (step === "mfa") {
    return (
      <div>
        <h3 className="text-sm font-medium text-foreground mb-4">Verification Required</h3>

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
          onClick={handleReset}
          className="mt-4 w-full rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Signing Step
  if (step === "signing") {
    return (
      <div>
        <h3 className="text-sm font-medium text-foreground mb-4">Withdraw Funds</h3>

        <div className="py-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-foreground/20 border-t-foreground" />
          <h3 className="text-lg font-medium text-foreground">
            Confirm in Wallet
          </h3>
          <p className="mt-2 text-sm text-muted">
            Please confirm the transaction in your wallet...
          </p>
        </div>
      </div>
    );
  }

  // Confirming Step
  if (step === "confirming") {
    return (
      <div>
        <h3 className="text-sm font-medium text-foreground mb-4">Withdraw Funds</h3>

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
      </div>
    );
  }

  // Success Step
  if (step === "success") {
    return (
      <div>
        <h3 className="text-sm font-medium text-foreground mb-4">Withdraw Funds</h3>

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
            onClick={handleReset}
            className="mt-6 w-full rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return null;
}
