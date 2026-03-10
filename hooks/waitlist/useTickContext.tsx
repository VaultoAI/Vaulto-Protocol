"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const TickContext = createContext<number>(0);

export function TickProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 333);

    return () => clearInterval(interval);
  }, []);

  return <TickContext.Provider value={tick}>{children}</TickContext.Provider>;
}

export function useTick(): number {
  return useContext(TickContext);
}
