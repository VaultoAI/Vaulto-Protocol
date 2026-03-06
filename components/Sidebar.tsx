"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/mint", label: "Mint" },
  { href: "/swap", label: "Swap" },
  { href: "/earn", label: "Earn" },
  { href: "/predictions", label: "Predictions" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-10 flex h-full w-48 flex-col border-r border-border bg-background">
      <Link href="/mint" className="border-b border-border p-4 flex items-center">
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
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {nav.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
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
        <a
          href="https://legal.vaulto.ai/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="block py-1.5 text-xs text-muted transition-opacity hover:opacity-90"
        >
          Privacy Policy
        </a>
        <a
          href="https://legal.vaulto.ai/terms-of-service"
          target="_blank"
          rel="noopener noreferrer"
          className="block py-1.5 text-xs text-muted transition-opacity hover:opacity-90"
        >
          Terms of Service
        </a>
        <a
          href="https://api.vaulto.ai/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="block py-1.5 text-xs text-muted transition-opacity hover:opacity-90"
        >
          API Docs
        </a>
      </div>
    </aside>
  );
}
