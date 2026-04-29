"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "vaulto-install-dismissed-at";
const DISMISS_DAYS = 7;

export function MobileInstallBanner() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [platform, setPlatform] = useState<"android" | "ios" | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {});
    }

    const ua = navigator.userAgent;
    const isIOS =
      /iPhone|iPad|iPod/i.test(ua) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    const isAndroid = /Android/i.test(ua);
    if (!isIOS && !isAndroid) return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000) return;

    if (isIOS) {
      setPlatform("ios");
      setVisible(true);
      return;
    }

    setPlatform("android");

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  if (!visible || !platform) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Vaulto"
      className="sticky top-0 z-[60] flex items-center gap-3 border-b border-neutral-800 bg-neutral-950 px-3 py-2 text-white shadow-lg sm:hidden"
    >
      <img
        src="/icon-192.png"
        alt=""
        className="h-9 w-9 shrink-0 rounded-md"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">Explore Vaulto</p>
        <p className="truncate text-xs text-neutral-400">
          {platform === "ios"
            ? "Tap Share, then Add to Home Screen"
            : "Install the app for a faster experience"}
        </p>
      </div>
      {platform === "android" && deferred && (
        <button
          type="button"
          onClick={install}
          className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black active:opacity-80"
        >
          Install
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded p-1 text-neutral-400 active:text-white"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
