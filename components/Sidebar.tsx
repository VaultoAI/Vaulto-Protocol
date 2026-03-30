"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LegalLink } from "./LegalLink";

const nav = [
  { href: "/explore", label: "Explore" },
  { href: "/earn", label: "Earn" },
  { href: "/predictions", label: "Predictions" },
] as const;

function HamburgerIcon() {
  return (
    <span className="relative block h-5 w-6">
      <span className="absolute left-0 top-0 block h-0.5 w-6 bg-current" />
      <span className="absolute left-0 top-2 block h-0.5 w-6 bg-current" />
      <span className="absolute left-0 top-4 block h-0.5 w-6 bg-current" />
    </span>
  );
}

function CloseIcon() {
  return (
    <span className="relative block h-3.5 w-3.5">
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 rotate-45 bg-current" />
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 -rotate-45 bg-current" />
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed left-4 top-14 z-30 flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-opacity hover:opacity-80 md:hidden"
          aria-label="Open menu"
        >
          <HamburgerIcon />
        </button>
      )}
      {open && (
        <div
          className="fixed inset-0 z-[9] bg-black/50 md:hidden"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-10 flex h-full w-48 flex-col border-r border-border bg-background transition-transform duration-200 ease-out md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      <div className="flex items-center justify-between border-b border-border p-4">
        <Link href="/explore" className="flex items-center">
          <span className="relative h-7 w-[100px] dark:hidden">
            <Image
              src="/vaulto-logo-light.png"
              alt="Vaulto"
              fill
              className="object-contain object-left"
              sizes="100px"
            />
          </span>
          <span className="relative h-7 w-[100px] hidden dark:block">
            <Image
              src="/vaulto-logo-dark.png"
              alt="Vaulto"
              fill
              className="object-contain object-left"
              sizes="100px"
            />
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-foreground transition-opacity hover:opacity-80 md:hidden"
          aria-label="Close menu"
        >
          <CloseIcon />
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {nav.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`rounded px-3 py-2 text-sm transition-opacity hover:opacity-90 ${
                active ? "bg-black/10 dark:bg-white/10" : ""
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <LegalLink
          type="privacy"
          className="block py-1.5 text-xs text-muted transition-opacity hover:opacity-90"
        >
          Privacy Policy
        </LegalLink>
        <LegalLink
          type="terms"
          className="block py-1.5 text-xs text-muted transition-opacity hover:opacity-90"
        >
          Terms of Service
        </LegalLink>
        <a
          href="https://api.vaulto.ai/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="block py-1.5 text-xs text-muted transition-opacity hover:opacity-90"
        >
          API Docs
        </a>
        <a
          href="https://discord.gg/wxXsxm7GGb"
          target="_blank"
          rel="noopener noreferrer"
          className="block py-1.5 text-xs text-muted transition-opacity hover:opacity-90"
        >
          Support
        </a>
      </div>
    </aside>
    </>
  );
}
