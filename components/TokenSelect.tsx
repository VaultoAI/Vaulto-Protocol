"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { TokenLogo } from "@/components/TokenLogo";
import { DemoBadge } from "@/components/DemoBadge";

type TokenWithName = { symbol: string; name: string };

type TokenSelectProps = {
  tokens: TokenWithName[];
  value: string;
  onChange: (symbol: string) => void;
  disabledValue?: string;
  ariaLabel: string;
  id?: string;
  demoSymbols?: Set<string>;
};

export function TokenSelect({
  tokens,
  value,
  onChange,
  disabledValue,
  ariaLabel,
  id,
  demoSymbols = new Set(),
}: TokenSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = value ? tokens.find((t) => t.symbol === value) : null;
  const selectedIsDemo = selected ? demoSymbols.has(selected.symbol) : false;

  // Group tokens into live markets and private companies
  const { liveTokens, demoTokens } = useMemo(() => {
    const live: TokenWithName[] = [];
    const demo: TokenWithName[] = [];
    for (const token of tokens) {
      if (demoSymbols.has(token.symbol)) {
        demo.push(token);
      } else {
        live.push(token);
      }
    }
    return { liveTokens: live, demoTokens: demo };
  }, [tokens, demoSymbols]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 min-w-0 rounded bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:ring-offset-1"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id ? `${id}-listbox` : undefined}
      >
        {selected ? (
          <>
            <TokenLogo symbol={selected.symbol} size={24} />
            <span className="truncate text-left font-medium">{selected.symbol}</span>
            {selectedIsDemo && <DemoBadge size="sm" />}
          </>
        ) : (
          <span className="text-muted-foreground">Select token</span>
        )}
        <svg
          className={`ml-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute right-0 top-full mt-1 z-50 min-w-[14rem] max-h-64 overflow-auto rounded border border-border bg-background shadow-lg py-1"
          aria-label={ariaLabel}
        >
          {liveTokens.length > 0 && (
            <>
              {demoTokens.length > 0 && (
                <li className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Live Markets
                </li>
              )}
              {liveTokens.map((token) => {
                const isDisabled = token.symbol === disabledValue;
                return (
                  <li key={token.symbol} role="option" aria-selected={token.symbol === value}>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (!isDisabled) {
                          onChange(token.symbol);
                          setOpen(false);
                        }
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                        isDisabled
                          ? "cursor-not-allowed opacity-50 text-muted-foreground"
                          : "hover:bg-muted/60 text-foreground"
                      } ${token.symbol === value ? "bg-muted/40" : ""}`}
                    >
                      <TokenLogo symbol={token.symbol} size={28} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{token.name}</span>
                        <span className="block truncate text-sm text-muted-foreground">{token.symbol}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </>
          )}
          {demoTokens.length > 0 && (
            <>
              <li className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 border-t border-border mt-1 pt-2">
                Private Companies
                <DemoBadge size="sm" />
              </li>
              {demoTokens.map((token) => {
                const isDisabled = token.symbol === disabledValue;
                return (
                  <li key={token.symbol} role="option" aria-selected={token.symbol === value}>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (!isDisabled) {
                          onChange(token.symbol);
                          setOpen(false);
                        }
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                        isDisabled
                          ? "cursor-not-allowed opacity-50 text-muted-foreground"
                          : "hover:bg-muted/60 text-foreground"
                      } ${token.symbol === value ? "bg-muted/40" : ""}`}
                    >
                      <TokenLogo symbol={token.symbol} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{token.name}</span>
                        </div>
                        <span className="block truncate text-sm text-muted-foreground">{token.symbol}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
