"use client";

import { useState } from "react";
import { Wallet, Shield, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useAccount, useSignMessage } from "wagmi";
import { usePrivy, useWallets } from "@privy-io/react-auth";

interface WalletVerificationStepProps {
  onComplete: () => void;
  onRejected: (reason: string) => void;
}

export function WalletVerificationStep({
  onComplete,
  onRejected,
}: WalletVerificationStepProps) {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"connect" | "sign" | "screening">("connect");

  const activeWallet = wallets[0];
  const displayAddress = activeWallet?.address;

  const handleVerify = async () => {
    if (!address || !chainId) {
      setError("Please connect your wallet first");
      return;
    }

    setIsVerifying(true);
    setError(null);
    setStep("sign");

    try {
      // Get verification message from server
      const messageResponse = await fetch(
        `/api/onboarding/wallet/screen?walletAddress=${address}`
      );
      const messageData = await messageResponse.json();

      if (!messageResponse.ok) {
        throw new Error(messageData.error || "Failed to get verification message");
      }

      // Sign the message
      const signature = await signMessageAsync({
        message: messageData.message,
      });

      setStep("screening");

      // Submit for screening
      const screenResponse = await fetch("/api/onboarding/wallet/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          chainId,
          signature,
          timestamp: messageData.timestamp,
        }),
      });

      const screenData = await screenResponse.json();

      if (!screenResponse.ok) {
        throw new Error(screenData.error || "Wallet screening failed");
      }

      if (screenData.status === "REJECTED") {
        onRejected(screenData.reason || "Wallet failed compliance screening");
        return;
      }

      onComplete();
    } catch (err) {
      if (err instanceof Error && err.message.includes("User rejected")) {
        setError("You must sign the message to verify wallet ownership");
        setStep("connect");
      } else {
        setError(err instanceof Error ? err.message : "An error occurred");
        setStep("connect");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const ConnectWalletButton = () => {
    if (!ready) {
      return (
        <button
          type="button"
          disabled
          className="rounded-lg bg-foreground px-6 py-3 font-medium text-background opacity-50"
        >
          Loading...
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={login}
        className="rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
      >
        Connect Wallet
      </button>
    );
  };

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <Wallet className="mx-auto h-12 w-12 text-foreground" />
          <h2 className="mt-4 text-2xl font-semibold">Connect Your Wallet</h2>
          <p className="mt-2 text-muted">
            Connect and verify ownership of your wallet
          </p>
        </div>

        <div className="rounded-lg border border-border p-6 space-y-4">
          <h3 className="font-medium">What we&apos;ll verify:</h3>
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex items-start gap-3">
              <Shield className="h-5 w-5 flex-shrink-0 text-green-500" />
              <span>
                <strong>Ownership:</strong> Sign a message to prove you control
                this wallet
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Shield className="h-5 w-5 flex-shrink-0 text-green-500" />
              <span>
                <strong>Compliance:</strong> Screen for sanctions and high-risk
                activity
              </span>
            </li>
          </ul>
        </div>

        <div className="flex justify-center">
          <ConnectWalletButton />
        </div>

        <p className="text-center text-sm text-muted">
          We support Ethereum, Polygon, Arbitrum, Optimism, and Base wallets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <Wallet className="mx-auto h-12 w-12 text-foreground" />
        <h2 className="mt-4 text-2xl font-semibold">Verify Your Wallet</h2>
        <p className="mt-2 text-muted">
          Sign a message to verify ownership and complete screening
        </p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Connected Wallet</span>
          <span className="font-mono text-sm">
            {displayAddress ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}` : `${address?.slice(0, 6)}...${address?.slice(-4)}`}
          </span>
        </div>
      </div>

      {step !== "connect" && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-center gap-3">
            {step === "sign" ? (
              <Loader2 className="h-5 w-5 animate-spin text-foreground" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            <span className={step === "sign" ? "text-foreground" : "text-muted"}>
              Signing ownership verification
            </span>
          </div>
          <div className="flex items-center gap-3">
            {step === "screening" ? (
              <Loader2 className="h-5 w-5 animate-spin text-foreground" />
            ) : step === "sign" ? (
              <div className="h-5 w-5 rounded-full border-2 border-muted" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            )}
            <span className={step === "screening" ? "text-foreground" : "text-muted"}>
              Compliance screening
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4 text-amber-700 dark:text-amber-400">
        <p className="text-sm">
          <strong>Important:</strong> Signing this message does not grant access
          to your funds. It only proves you own this wallet address.
        </p>
      </div>

      <button
        onClick={handleVerify}
        disabled={isVerifying}
        className="w-full rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isVerifying ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            {step === "sign" ? "Waiting for signature..." : "Screening wallet..."}
          </span>
        ) : (
          "Sign & Verify Wallet"
        )}
      </button>

      <div className="flex justify-center">
        <ConnectWalletButton />
      </div>
    </div>
  );
}
