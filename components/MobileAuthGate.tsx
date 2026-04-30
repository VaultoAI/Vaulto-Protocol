"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { MobileSignIn } from "./landing/MobileSignIn";

const MOBILE_QUERY = "(max-width: 767px)";

export function MobileAuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  if (isMobile === null) {
    return <div className="fixed inset-0 bg-white" aria-hidden />;
  }

  if (!isMobile) {
    return <>{children}</>;
  }

  if (!ready) {
    return <div className="fixed inset-0 bg-white" aria-hidden />;
  }

  if (!authenticated) {
    return <MobileSignIn />;
  }

  return <>{children}</>;
}
